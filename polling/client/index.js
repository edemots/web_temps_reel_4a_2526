const messageForm = document.getElementById("message-form");
const messagesList = document.getElementById("messages-list");
const messageTemplate = document.getElementById("message-template");

messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(event.target);

  const req = await fetch("http://localhost:3000/messages", {
    method: "POST",
    body: formData,
  });
  const res = await req.json();

  console.log(res);
});

async function getMessages() {
  const req = await fetch("http://localhost:3000/messages");
  const messages = await req.json();

  for (const message of messages) {
    const li = document.importNode(messageTemplate.content, true);
    const paragraph = li.querySelectorAll("p");
    const time = li.querySelectorAll("time");
    paragraph[0].textContent = message.content;
    time[0].textContent = new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(message.id));

    messagesList.appendChild(li);
  }
}

getMessages();
