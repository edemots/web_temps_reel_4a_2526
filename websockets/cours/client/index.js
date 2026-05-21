document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("whiteboard");
  const ctx = canvas.getContext("2d");
  const usernameInput = document.getElementById("username");

  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let color = "black";
  let thickness = 5;

  const ws = new WebSocket("ws://localhost:3000/ws");

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    // Replicate the drawing on the canvas
    draw(data);
  };

  function startDrawing() {
    isDrawing = true;
    const username = usernameInput.value;
    ws.send(
      JSON.stringify({
        type: "userJoined",
        username: username,
      }),
    );
  }

  canvas.addEventListener("mousedown", (e) => {
    isDrawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!isDrawing) return;
    const x = e.offsetX;
    const y = e.offsetY;
    ws.send(
      JSON.stringify({
        type: "draw",
        color: color,
        thickness: thickness,
        fromX: lastX,
        fromY: lastY,
        toX: x,
        toY: y,
      }),
    );
    [lastX, lastY] = [x, y];
  });

  canvas.addEventListener("mouseup", () => {
    isDrawing = false;
  });

  function draw(data) {
    ctx.beginPath();
    ctx.moveTo(data.fromX, data.fromY);
    ctx.lineTo(data.toX, data.toY);
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.thickness;
    ctx.stroke();
  }
});
