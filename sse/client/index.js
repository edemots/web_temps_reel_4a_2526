const API_URL = "http://localhost:3000";

document.addEventListener("DOMContentLoaded", function () {
  localStorage.removeItem("lastMessageId");

  const eventSource = new EventSource(API_URL + "/event");
  eventSource.addEventListener("message", (e) => {
    const lastMessageId = localStorage.getItem("lastMessageId");

    if (!lastMessageId || e.lastEventId > lastMessageId) {
      const prices = JSON.parse(e.data);

      Object.entries(prices).forEach(([currency, price]) => {
        const priceElement = document.getElementById(currency.toLowerCase());
        if (priceElement) {
          const h2 = priceElement.querySelector("h2");
          if (h2) {
            h2.textContent = price.toFixed(2);
          }
        }
      });

      const time = document.getElementById("time");
      time.textContent = Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(prices.time * 1000));
      time.setAttribute("datetime", prices.time * 1000);

      localStorage.setItem("lastMessageId", e.lastEventId);
    }
  });
});
