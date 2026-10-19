const search = document.getElementById('search');
const category = document.getElementById('category');
const cards = [...document.querySelectorAll('.writeup-card')];
function filterWriteups() {
  const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let count = 0;
  for (const card of cards) {
    const matches = (!category.value || card.dataset.category === category.value) && terms.every(term => card.textContent.toLowerCase().includes(term));
    card.hidden = !matches;
    if (matches) count++;
  }
  document.getElementById('results').textContent = `${count} ${count === 1 ? 'writeup' : 'writeups'}`;
  document.getElementById('empty').hidden = count !== 0;
}
search.addEventListener('input', filterWriteups);
category.addEventListener('change', filterWriteups);
