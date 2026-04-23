import { Hono } from "hono";
import { randomString } from "./utils.js";

type Side = "X" | "O";
type Winner = Side | "draw" | null;
type RoomStatus = "waiting" | "active" | "finished";

type Player = {
  id: number;
  username: string;
  side: Side;
};

type Room = {
  id: number;
  code: string;
  grid: string[][];
  players: Player[];
  status: RoomStatus;
  nextTurn: Side | null;
  winner: Winner;
  version: number;
};

const rooms = new Map<string, Room>();
const roomWaiters = new Map<string, Set<(room: Room) => void>>();

let nextId = 1;

const tictactoe = new Hono().basePath("/tictactoe");

const createEmptyGrid = () =>
  Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => ""));

const nextIdentifier = () => nextId++;

const getRoom = (code: string) => rooms.get(code);

const getPlayer = (room: Room, playerId: number) =>
  room.players.find((player) => player.id === playerId);

const getOpponentSide = (side: Side): Side => (side === "X" ? "O" : "X");

const listJoinableRooms = () =>
  Array.from(rooms.values())
    .filter((room) => room.players.length < 2)
    .map((room) => ({
      code: room.code,
      players: room.players.map((player) => player.username),
    }));

const createRoomCode = () => {
  let code = randomString(5);

  while (rooms.has(code)) {
    code = randomString(5);
  }

  return code;
};

const notifyRoomUpdate = (room: Room) => {
  const waiters = roomWaiters.get(room.code);

  if (!waiters) {
    return;
  }

  roomWaiters.delete(room.code);

  for (const waiter of waiters) {
    waiter(room);
  }
};

const advanceRoomVersion = (room: Room) => {
  room.version += 1;
  notifyRoomUpdate(room);
};

const resetRoomState = (room: Room) => {
  room.grid = createEmptyGrid();
  room.status = room.players.length === 2 ? "active" : "waiting";
  room.nextTurn = room.players.length === 2 ? "X" : null;
  room.winner = null;
};

const readTextField = (formData: FormData, field: string) =>
  String(formData.get(field) ?? "").trim();

const readNumberField = (formData: FormData, field: string) => {
  const value = Number(formData.get(field));
  return Number.isInteger(value) ? value : null;
};

const calculateWinner = (grid: string[][]): Side | null => {
  const lines = [
    [
      [0, 0],
      [0, 1],
      [0, 2],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [2, 0],
      [2, 1],
      [2, 2],
    ],
    [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [0, 2],
      [1, 2],
      [2, 2],
    ],
    [
      [0, 0],
      [1, 1],
      [2, 2],
    ],
    [
      [0, 2],
      [1, 1],
      [2, 0],
    ],
  ] as const;

  for (const line of lines) {
    const [[firstRow, firstCol], [secondRow, secondCol], [thirdRow, thirdCol]] =
      line;
    const mark = grid[firstRow][firstCol];

    if (
      mark !== "" &&
      mark === grid[secondRow][secondCol] &&
      mark === grid[thirdRow][thirdCol]
    ) {
      return mark as Side;
    }
  }

  return null;
};

const isDraw = (grid: string[][]) =>
  grid.every((row) => row.every((cell) => cell !== ""));

tictactoe.get("/", (c) => c.json(listJoinableRooms()));

tictactoe.post("/room", async (c) => {
  const data = await c.req.formData();
  const username = readTextField(data, "username");

  if (!username) {
    return c.text("Le pseudo est obligatoire", 400);
  }

  const room: Room = {
    id: nextIdentifier(),
    code: createRoomCode(),
    grid: createEmptyGrid(),
    players: [
      {
        id: nextIdentifier(),
        username,
        side: "X",
      },
    ],
    status: "waiting",
    nextTurn: null,
    winner: null,
    version: 1,
  };

  rooms.set(room.code, room);

  return c.json(room, 201);
});

tictactoe.post("/room/:code", async (c) => {
  const room = getRoom(c.req.param("code"));

  if (!room) {
    return c.notFound();
  }

  if (room.players.length >= 2) {
    return c.text("", 403);
  }

  const data = await c.req.formData();
  const username = readTextField(data, "username");

  if (!username) {
    return c.text("Le pseudo est obligatoire", 400);
  }

  room.players.push({
    id: nextIdentifier(),
    username,
    side: "O",
  });
  room.status = "active";
  room.nextTurn = "X";
  advanceRoomVersion(room);

  return c.json(room);
});

tictactoe.get("/room/:code", (c) => {
  const room = getRoom(c.req.param("code"));

  if (!room) {
    return c.notFound();
  }

  return c.json(room);
});

tictactoe.post("/room/:code/subscribe", async (c) => {
  c.header("Connection", "Keep-Alive");
  c.header("Keep-Alive", "timeout=30, max=1000");

  const room = getRoom(c.req.param("code"));

  if (!room) {
    return c.notFound();
  }

  const data = await c.req.formData();
  const playerId = readNumberField(data, "player_id");

  if (playerId === null || !getPlayer(room, playerId)) {
    return c.text("", 403);
  }

  const version = readNumberField(data, "version") ?? 0;

  if (room.version > version) {
    return c.json(room);
  }

  return new Promise<Response>((resolve) => {
    let settled = false;

    const waiters = roomWaiters.get(room.code) ?? new Set<(room: Room) => void>();
    roomWaiters.set(room.code, waiters);

    const settle = (response: Response) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      waiters.delete(waiter);

      if (waiters.size === 0) {
        roomWaiters.delete(room.code);
      }

      resolve(response);
    };

    const waiter = (updatedRoom: Room) => {
      settle(Response.json(updatedRoom));
    };

    const timeoutId = setTimeout(() => {
      settle(new Response(null, { status: 204 }));
    }, 30_000);

    waiters.add(waiter);
  });
});

tictactoe.post("/room/:code/move", async (c) => {
  const room = getRoom(c.req.param("code"));

  if (!room) {
    return c.notFound();
  }

  const data = await c.req.formData();
  const playerId = readNumberField(data, "player_id");
  const row = readNumberField(data, "row");
  const col = readNumberField(data, "col");

  if (playerId === null) {
    return c.text("", 403);
  }

  const player = getPlayer(room, playerId);

  if (!player) {
    return c.text("", 403);
  }

  if (row === null || col === null || row < 0 || row > 2 || col < 0 || col > 2) {
    return c.text("Coordonnees invalides", 400);
  }

  if (room.players.length < 2 || room.status === "waiting") {
    return c.text("En attente des joueurs", 409);
  }

  if (room.status === "finished") {
    return c.text("La partie est deja terminee", 409);
  }

  if (room.nextTurn !== player.side) {
    return c.text("Ce n'est pas votre tour", 409);
  }

  if (room.grid[row][col] !== "") {
    return c.text("Cette case est deja prise", 409);
  }

  room.grid[row][col] = player.side;

  const winner = calculateWinner(room.grid);

  if (winner) {
    room.status = "finished";
    room.winner = winner;
    room.nextTurn = null;
  } else if (isDraw(room.grid)) {
    room.status = "finished";
    room.winner = "draw";
    room.nextTurn = null;
  } else {
    room.status = "active";
    room.winner = null;
    room.nextTurn = getOpponentSide(player.side);
  }

  advanceRoomVersion(room);

  return c.json(room);
});

tictactoe.post("/room/:code/reset", async (c) => {
  const room = getRoom(c.req.param("code"));

  if (!room) {
    return c.notFound();
  }

  const data = await c.req.formData();
  const playerId = readNumberField(data, "player_id");

  if (playerId === null || !getPlayer(room, playerId)) {
    return c.text("", 403);
  }

  if (room.status !== "finished") {
    return c.text("La partie n'est pas terminee", 409);
  }

  resetRoomState(room);
  advanceRoomVersion(room);

  return c.json(room);
});

tictactoe.post("/room/:code/leave", async (c) => {
  const room = getRoom(c.req.param("code"));

  if (!room) {
    return c.notFound();
  }

  const data = await c.req.formData();
  const playerId = readNumberField(data, "player_id");

  if (playerId === null) {
    return c.text("", 403);
  }

  const playerIndex = room.players.findIndex((player) => player.id === playerId);

  if (playerIndex < 0) {
    return c.text("", 403);
  }

  room.players.splice(playerIndex, 1);

  if (room.players.length === 0) {
    rooms.delete(room.code);
    roomWaiters.delete(room.code);
    return c.body(null, 204);
  }

  room.players[0].side = "X";
  resetRoomState(room);
  advanceRoomVersion(room);

  return c.json(room);
});

export { tictactoe };
