/** Convert viewport coordinates into an element's unrotated layout. */
export function chartCoordinates(element: HTMLElement, clientX: number, clientY: number) {
  const rect = element.getBoundingClientRect()
  if (element.closest('.chart-dialog[data-sideways="true"]')) {
    return { x: (clientY - rect.top) * element.offsetWidth / rect.height, y: (rect.right - clientX) * element.offsetHeight / rect.width }
  }
  return { x: (clientX - rect.left) * element.offsetWidth / rect.width, y: (clientY - rect.top) * element.offsetHeight / rect.height }
}
