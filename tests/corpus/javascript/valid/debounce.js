// covers: code written without semicolons; arrow functions; a module with export
export function debounce(fn, wait = 100) {
  let timer = null
  return function (...args) {
    clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn.apply(this, args)
    }, wait)
  }
}

export const once = fn => {
  let called = false
  let result
  return (...args) => {
    if (!called) {
      called = true
      result = fn(...args)
    }
    return result
  }
}

export const range = (start, end, step = 1) =>
  Array.from(
    { length: Math.max(0, Math.ceil((end - start) / step)) },
    (_, i) => start + i * step
  )

;[1, 2, 3].forEach(n => console.log(range(0, n)))
