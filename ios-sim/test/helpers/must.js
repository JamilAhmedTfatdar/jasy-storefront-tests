// A check that stops the test with a plain message when it is not true.
export function must(condition, message) {
  if (!condition) throw new Error(message);
}
