const API_URL = "http://localhost:3000";

document.addEventListener("DOMContentLoaded", function () {
  const messagesContainer = document.getElementById("messages");
  const messageTemplate = document.getElementById("message-template");
  const messageForm = document.getElementById("message-form");

  const eventSource = new EventSource(API_URL + "/messages");

  eventSource.addEventListener("successful_connection", (e) => {
    alert(JSON.parse(e.data).message);
  });

  eventSource.addEventListener("message", (e) => {
    const messageData = JSON.parse(e.data);
    const messageElement = messageTemplate.content.cloneNode(true);
    messageElement.querySelector("p").textContent = messageData.message;
    messagesContainer.appendChild(messageElement);
  });

  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    await fetch(API_URL + "/messages", {
      method: "POST",
      body: new FormData(e.target),
    });

    e.target.reset();
  });
});
