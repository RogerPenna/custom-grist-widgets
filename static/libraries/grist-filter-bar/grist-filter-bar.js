export class GristFilterBar {
  constructor(options) {
    this.options = options;
    this.init();
  }

  init() {
    const filterInput = document.getElementById('filter-input');
    if (filterInput) {
      filterInput.addEventListener('input', (e) => {
        this.options.onFilter(e.target.value);
      });
    } else {
      console.error('filter-input not found in GristFilterBar.init()');
    }
  }
}
