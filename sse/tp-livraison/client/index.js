const API_URL = "http://localhost:3000";

document.addEventListener('DOMContentLoaded', () => {
  const itemEl = document.getElementById('item')
    const courierEl = document.getElementById('courier')
    const statusEl = document.getElementById('status')
    const etaEl = document.getElementById('eta')
    const progressTextEl = document.getElementById('progress-text')
    const progressBarEl = document.getElementById('progress-bar')
    const eventsEl = document.getElementById('events')

    function renderState(state) {
      itemEl.textContent = state.item
      courierEl.textContent = state.courier
      statusEl.textContent = state.status
      etaEl.textContent = Intl.DateTimeFormat('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(state.eta))
      progressTextEl.textContent = state.progress
      progressBarEl.style.width = state.progress + '%'
    }

    function addEvent(event) {
      const div = document.createElement('div')
      div.className = 'event'
      div.textContent = `${new Date(event.createdAt).toLocaleTimeString()} — ${event.message}`
      eventsEl.prepend(div)
    }

    fetch(`${API_URL}/api/delivery`)
      .then((res) => res.json())
      .then((data) => {
        renderState(data.state)
        data.events.forEach(addEvent)
      })

    const source = new EventSource(`${API_URL}/api/events`)

    source.addEventListener('delivery:update', (event) => {
      const data = JSON.parse(event.data)
      renderState(data)
    })

    source.addEventListener('delivery:event', (event) => {
      const data = JSON.parse(event.data)
      addEvent(data)
    })
})
