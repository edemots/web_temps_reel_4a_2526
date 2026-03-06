const messageForm = document.getElementById("message-form");
const messagesList = document.getElementById("messages-list");
const messageTemplate = document.getElementById("message-template");

messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(event.target);

  await fetch("http://localhost:3000/messages", {
    method: "POST",
    body: formData,
  });
});

async function getMessages() {
  const req = await fetch("http://localhost:3000/messages");
  const messages = await req.json();

  messagesList.innerHTML = "";
  for (const message of messages) {
    addMessage(message);
  }
}

function addMessage(message) {
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

async function pollMessages() {
  // await getMessages();
  // setInterval(getMessages, 1000);

  getMessages().then(() => setTimeout(pollMessages, 1000));
}

async function subscribeToMessages() {
  const req = await fetch("http://localhost:3000/messages/subscribe");
  if (req.status != 204) {
    const message = await req.json();
    addMessage(message);
  }

  await subscribeToMessages();
}

getMessages();
subscribeToMessages();

// pollMessages();
