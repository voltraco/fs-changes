'use strict'
module.exports = function (a, b, cb) {
  const max = Math.max(a.length, b.length)
  let delta = { added: [], removed: [] }
  let i = 0

  while (i !== max) {
    if (b[i] && a.indexOf(b[i]) < 0) delta.added.push(b[i])
    if (a[i] && b.indexOf(a[i]) < 0) delta.removed.push(a[i])
    ++i
  }

  cb(delta)
}

