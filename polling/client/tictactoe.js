const API_BASE_URL = "http://localhost:3000";

document.addEventListener("DOMContentLoaded", () => {
  const usernameForm = document.getElementById("username-form");
  const rooms = document.getElementById("rooms");
  const roomsList = document.getElementById("rooms-list");
  const roomItemTemplate = document.getElementById("room-item-template");
  const playerItemTemplate = document.getElementById("player-item-template");
  const createRoomForm = document.getElementById("create-room");
  const playground = document.getElementById("playground");
  const lobbyLogoutBtn = document.getElementById("lobby-logout-btn");
  const roomLogoutBtn = document.getElementById("room-logout-btn");
  const leaveRoomBtn = document.getElementById("leave-room-btn");
  const lobbyStatus = document.getElementById("lobby-status");
  const grid = document.getElementById("tictactoe-grid");
  const roomCodeLabel = document.getElementById("room-code");
  const roomPlayers = document.getElementById("room-players");
  const roomStatus = document.getElementById("room-status");
  const roomSide = document.getElementById("room-side");
  const replayBtn = document.getElementById("replay-btn");

  const state = {
    room: null,
    pollGeneration: 0,
    lobbyRefreshId: null,
  };

  const delay = (duration) =>
    new Promise((resolve) => {
      setTimeout(resolve, duration);
    });

  const getUsername = () => localStorage.getItem("username") ?? "";

  const getCurrentRoomCode = () => localStorage.getItem("current_room") ?? "";

  const getPlayerId = () => {
    const playerId = Number(localStorage.getItem("pid"));

    return Number.isInteger(playerId) ? playerId : null;
  };

  const clearRoomStorage = () => {
    localStorage.removeItem("pid");
    localStorage.removeItem("current_room");
    stopRoomPolling();
  };

  const logout = async () => {
    stopLobbyRefresh();
    const hasLeftRoom = await leaveCurrentRoom();

    if (!hasLeftRoom) {
      return;
    }

    localStorage.removeItem("username");
    state.room = null;
    showLogin();
  };

  const stopRoomPolling = () => {
    state.pollGeneration += 1;
  };

  const startRoomPolling = (code) => {
    stopRoomPolling();
    const generation = state.pollGeneration;
    pollRoom(code, generation);
  };

  const stopLobbyRefresh = () => {
    if (state.lobbyRefreshId !== null) {
      clearInterval(state.lobbyRefreshId);
      state.lobbyRefreshId = null;
    }
  };

  const startLobbyRefresh = () => {
    if (state.lobbyRefreshId !== null) {
      return;
    }

    refreshRooms();
    state.lobbyRefreshId = setInterval(refreshRooms, 3000);
  };

  const showLogin = () => {
    usernameForm.style.display = "block";
    rooms.style.display = "none";
    playground.style.display = "none";
    lobbyStatus.textContent = "";
  };

  const showLobby = () => {
    usernameForm.style.display = "none";
    rooms.style.display = "block";
    playground.style.display = "none";
    state.room = null;
    startLobbyRefresh();
  };

  const showRoom = () => {
    usernameForm.style.display = "none";
    rooms.style.display = "none";
    playground.style.display = "block";
    stopLobbyRefresh();
  };

  const getMyPlayer = (room = state.room) => {
    const playerId = getPlayerId();

    if (!room || playerId === null) {
      return null;
    }

    return room.players.find((player) => player.id === playerId) ?? null;
  };

  const canPlayCell = (row, col) => {
    const room = state.room;
    const player = getMyPlayer(room);

    if (!room || !player) {
      return false;
    }

    if (room.status !== "active" || room.players.length < 2) {
      return false;
    }

    if (room.nextTurn !== player.side) {
      return false;
    }

    return room.grid[row][col] === "";
  };

  const renderRoomPlayers = (room) => {
    roomPlayers.innerHTML = "";

    for (const player of room.players) {
      const fragment = document.importNode(playerItemTemplate.content, true);
      const item = fragment.querySelector("li");
      const suffix = getPlayerId() === player.id ? " (vous)" : "";
      item.textContent = `${player.username} (${player.side})${suffix}`;
      roomPlayers.appendChild(fragment);
    }
  };

  const getWinnerLabel = (room) => {
    if (room.winner === "draw") {
      return "Match nul.";
    }

    const winner = room.players.find((player) => player.side === room.winner);

    if (!winner) {
      return "Partie terminée.";
    }

    return getPlayerId() === winner.id
      ? `Vous avez gagne avec ${winner.side}.`
      : `${winner.username} a gagne avec ${winner.side}.`;
  };

  const renderRoomStatus = (room) => {
    const player = getMyPlayer(room);

    roomSide.textContent = player
      ? `Vous jouez avec ${player.side}.`
      : "Vous ne faites pas partie de cette partie.";

    if (room.players.length < 2 || room.status === "waiting") {
      roomStatus.textContent = "En attente d'un deuxieme joueur...";
      return;
    }

    if (room.status === "finished") {
      roomStatus.textContent = getWinnerLabel(room);
      return;
    }

    if (player && room.nextTurn === player.side) {
      roomStatus.textContent = `C'est votre tour (${player.side}).`;
      return;
    }

    const activePlayer = room.players.find((entry) => entry.side === room.nextTurn);
    roomStatus.textContent = activePlayer
      ? `En attente de ${activePlayer.username} (${activePlayer.side}).`
      : "En attente de l'autre joueur.";
  };

  function fillGrid(board) {
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const cell = grid.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        const clickable = canPlayCell(row, col);

        cell.textContent = board[row][col] || "";
        cell.style.cursor = clickable ? "pointer" : "default";
        cell.style.backgroundColor = clickable ? "#edf4ff" : "#fff";
      }
    }
  }

  const renderRoom = () => {
    const room = state.room;

    if (!room) {
      return;
    }

    localStorage.setItem("current_room", room.code);
    roomCodeLabel.textContent = `Partie #${room.code}`;
    renderRoomPlayers(room);
    renderRoomStatus(room);
    fillGrid(room.grid);
    replayBtn.hidden = room.status !== "finished";
    replayBtn.disabled = room.status !== "finished";
    showRoom();
  };

  const applyRoomState = (room) => {
    state.room = room;
    renderRoom();
  };

  const showRequestMessage = (message) => {
    if (message) {
      roomStatus.textContent = message;
    }
  };

  const showLobbyMessage = (message) => {
    lobbyStatus.textContent = message || "";
  };

  const handleRoomFailure = async (response) => {
    if (state.room && (response.status === 403 || response.status === 404)) {
      clearRoomStorage();
      showLobby();
      return;
    }

    showRequestMessage(await response.text());
  };

  const fetchRoom = async (code) => {
    const response = await fetch(`${API_BASE_URL}/tictactoe/room/${code}`);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error("Impossible de charger la partie");
    }

    return response.json();
  };

  const renderRooms = (availableRooms) => {
    roomsList.innerHTML = "";

    if (availableRooms.length === 0) {
      const item = document.createElement("li");
      item.textContent = "Aucune partie disponible pour le moment.";
      roomsList.appendChild(item);
      return;
    }

    for (const room of availableRooms) {
      const fragment = document.importNode(roomItemTemplate.content, true);
      const title = fragment.querySelector("p");
      const playerList = fragment.querySelector("ul");
      const joinButton = fragment.querySelector("button");

      title.textContent = `#${room.code}`;
      playerList.innerHTML = "";

      for (const playerName of room.players) {
        const playerFragment = document.importNode(playerItemTemplate.content, true);
        const playerItem = playerFragment.querySelector("li");
        playerItem.textContent = playerName;
        playerList.appendChild(playerFragment);
      }

      joinButton.addEventListener("click", async () => {
        joinButton.disabled = true;

        try {
          const formData = new FormData();
          formData.set("username", getUsername());

          const response = await fetch(
            `${API_BASE_URL}/tictactoe/room/${room.code}`,
            {
              method: "POST",
              body: formData,
            },
          );

          if (!response.ok) {
            showLobbyMessage(
              response.status === 404
                ? "Cette partie n'existe plus."
                : response.status === 403
                  ? "Cette partie est deja complete."
                  : await response.text(),
            );
            await refreshRooms();
            return;
          }

          const nextRoom = await response.json();
          const joinedPlayer = nextRoom.players.find((player) => player.side === "O");

          if (!joinedPlayer) {
            showLobbyMessage("Impossible d'identifier le joueur qui vient de rejoindre.");
            return;
          }

          localStorage.setItem("pid", joinedPlayer.id);
          showLobbyMessage("");
          applyRoomState(nextRoom);
          startRoomPolling(nextRoom.code);
        } finally {
          joinButton.disabled = false;
        }
      });

      roomsList.appendChild(fragment);
    }
  };

  const refreshRooms = async () => {
    if (rooms.style.display === "none") {
      return;
    }

    const response = await fetch(`${API_BASE_URL}/tictactoe`);

    if (!response.ok) {
      showLobbyMessage("Impossible d'actualiser la liste des parties.");
      return;
    }

    const availableRooms = await response.json();
    showLobbyMessage("");
    renderRooms(availableRooms);
  };

  const createRoom = async () => {
    const formData = new FormData();
    formData.set("username", getUsername());

    const response = await fetch(`${API_BASE_URL}/tictactoe/room`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      showLobbyMessage(await response.text());
      return;
    }

    const room = await response.json();
    const owner = room.players.find((player) => player.side === "X");

    if (!owner) {
      showLobbyMessage("Impossible d'identifier le createur de la partie.");
      return;
    }

    localStorage.setItem("pid", owner.id);
    showLobbyMessage("");
    applyRoomState(room);
    startRoomPolling(room.code);
  };

  const leaveCurrentRoom = async () => {
    const room = state.room;
    const playerId = getPlayerId();

    stopRoomPolling();

    if (!room || playerId === null) {
      clearRoomStorage();
      return true;
    }

    const formData = new FormData();
    formData.set("player_id", String(playerId));

    try {
      const response = await fetch(
        `${API_BASE_URL}/tictactoe/room/${room.code}/leave`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok && response.status !== 404) {
        showRequestMessage(await response.text());
        return false;
      }
    } catch (_error) {
      showRequestMessage("Impossible de quitter la partie.");
      return false;
    }

    clearRoomStorage();
    state.room = null;
    return true;
  };

  const submitMove = async (row, col) => {
    const room = state.room;
    const playerId = getPlayerId();

    if (!room || playerId === null) {
      return;
    }

    const formData = new FormData();
    formData.set("player_id", String(playerId));
    formData.set("row", String(row));
    formData.set("col", String(col));

    const response = await fetch(`${API_BASE_URL}/tictactoe/room/${room.code}/move`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      await handleRoomFailure(response);
      return;
    }

    applyRoomState(await response.json());
  };

  const resetRoom = async () => {
    const room = state.room;
    const playerId = getPlayerId();

    if (!room || playerId === null) {
      return;
    }

    const formData = new FormData();
    formData.set("player_id", String(playerId));

    const response = await fetch(
      `${API_BASE_URL}/tictactoe/room/${room.code}/reset`,
      {
        method: "POST",
        body: formData,
      },
    );

    if (!response.ok) {
      await handleRoomFailure(response);
      return;
    }

    applyRoomState(await response.json());
  };

  const restoreRoomSession = async (code) => {
    try {
      const room = await fetchRoom(code);

      if (!room || !getMyPlayer(room)) {
        clearRoomStorage();
        showLobby();
        return;
      }

      applyRoomState(room);
      startRoomPolling(room.code);
    } catch (_error) {
      clearRoomStorage();
      showLobby();
    }
  };

  const pollRoom = async (code, generation) => {
    while (generation === state.pollGeneration) {
      const room = state.room;
      const playerId = getPlayerId();

      if (!room || room.code !== code || playerId === null) {
        return;
      }

      const formData = new FormData();
      formData.set("player_id", String(playerId));
      formData.set("version", String(room.version));

      let response;

      try {
        response = await fetch(
          `${API_BASE_URL}/tictactoe/room/${code}/subscribe`,
          {
            method: "POST",
            body: formData,
          },
        );
      } catch (_error) {
        await delay(1000);
        continue;
      }

      if (generation !== state.pollGeneration) {
        return;
      }

      if (response.status === 204) {
        continue;
      }

      if (response.status === 200) {
        applyRoomState(await response.json());
        continue;
      }

      if (response.status === 403 || response.status === 404) {
        clearRoomStorage();
        showLobby();
        return;
      }

      showRequestMessage(await response.text());
      await delay(1000);
    }
  };

  usernameForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(event.target);
    const username = String(formData.get("username") ?? "").trim();

    if (!username) {
      return;
    }

    localStorage.setItem("username", username);
    showLobby();
  });

  createRoomForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createRoom();
  });

  lobbyLogoutBtn.addEventListener("click", async () => {
    await logout();
  });
  roomLogoutBtn.addEventListener("click", async () => {
    await logout();
  });
  leaveRoomBtn.addEventListener("click", async () => {
    const hasLeftRoom = await leaveCurrentRoom();

    if (!hasLeftRoom) {
      return;
    }

    showLobby();
  });

  grid.addEventListener("click", async (event) => {
    const cell = event.target.closest("[data-row][data-col]");

    if (!cell) {
      return;
    }

    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);

    if (!canPlayCell(row, col)) {
      return;
    }

    await submitMove(row, col);
  });

  replayBtn.addEventListener("click", async () => {
    await resetRoom();
  });

  if (!getUsername()) {
    showLogin();
    return;
  }

  const storedRoomCode = getCurrentRoomCode();

  if (storedRoomCode && getPlayerId() !== null) {
    restoreRoomSession(storedRoomCode);
    return;
  }

  clearRoomStorage();
  showLobby();
});
