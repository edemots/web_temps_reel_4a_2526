const API_URL = "http://localhost:3000";

document.addEventListener("DOMContentLoaded", () => {
  const stateForm = document.getElementById("state-form");
  const incidentForm = document.getElementById("incident-form");

  stateForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(stateForm);

    await fetch(`${API_URL}/api/delivery/state`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: formData.get("status"),
        eta: formData.get("eta"),
      }),
    });
  });

  incidentForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(incidentForm);

    await fetch(`${API_URL}/api/delivery/incidents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: formData.get("message"),
      }),
    });

    incidentForm.reset();
  });
});
