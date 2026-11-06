import { bindNavigation, getPolls, pollCard, showAlert } from './ui.js';

await bindNavigation();
const grid = document.querySelector('#poll-grid');
if (grid) {
  try {
    const polls = await getPolls();
    grid.innerHTML = polls.map(pollCard).join('') || '<p class="text-secondary">No public polls yet. Be the first to create one.</p>';
  } catch (error) { showAlert(error.message, 'danger'); }
}
