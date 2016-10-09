'use strict'
const fs = require('fs')
const path = require('path')
const events = require('events')

module.exports = function Watch (opts) {
  opts = opts || {}
  const pattern = opts.pattern

  let dirs = {
    [opts.dir]: null
  }

  let e = new events.EventEmitter()

  const cb = p => {
    fs.stat(p, (err, stat) => {
      if (err) { // must have been deleted
        const isDir = !!dirs[p]
        if (isDir || pattern.test(p)) {
          e.emit('_removed', p, isDir)
          dirs[p] && dirs[p].close()
          delete dirs[p]
        }
      } else {
        if (stat.isDirectory()) {
          if (dirs[p]) return
          e.emit('_modified', p, true)
          dirs[p] = fs.watch(p, (_, file) => {
            cb(path.join(p, file))
          })
        } else if (pattern.test(p)) {
          e.emit('_modified', p)
        }
      }
    })
  }

  const readDirs = p => {
    const files = fs.readdirSync(p)
    const fileslen = files.length

    for (var i = 0; i < fileslen; i++) {
      const d = path.join(p, files[i])
      const stats = fs.statSync(d)

      if (stats.isDirectory()) {
        readDirs(d)
        dirs[d] = null
      }
    }
  }

  const watch = () => {
    Object.keys(dirs).map(loc => {
      if (dirs[loc]) return

      dirs[loc] = fs.watch(loc, (_, file) => {
        cb(path.join(loc, file))
      })
    })
  }

  readDirs(opts.dir)
  watch()

  e.addDir = p => {
    if (dirs[p]) return

    readDirs(p)
    watch()
  }

  return e
}

