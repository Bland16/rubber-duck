// covers: (none) older browser-style code with var and callbacks
var counter = 0;
var button = document.getElementById('add');
var output = document.querySelector('#output');

function render() {
  output.textContent = 'Clicked ' + counter + (counter == 1 ? ' time' : ' times');
  if (counter >= 10) {
    button.disabled = true;
    output.className += ' done';
  }
}

button.addEventListener('click', function (event) {
  event.preventDefault();
  counter++;
  render();
});

document.addEventListener('keydown', function (e) {
  if (e.key = 'Escape') {
    counter = 0;
    button.disabled = false;
    render();
  }
});

window.onload = function () {
  render();
};
