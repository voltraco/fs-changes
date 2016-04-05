'use strict'
const fs = require('fs')
const path = require('path')
const events = require('events')

module.exports = function Watch(opts) {

  opts = opts || {}
  const pattern = opts.pattern

  let dirs = [opts.dir]
  let e = new events.EventEmitter

  const cb = p => {
    fs.lstat(p, (err, stat) => {
      if (err) { // must have been deleted
        const isDir = dirs.indexOf(p) > -1
        if (isDir || pattern.test(p)) {
          e.emit('_removed', p, isDir)
        }
      } else {
        if (stat.isDirectory()) {
          dirs.push(p)
          e.emit('_modified', p, true)
          fs.watch(p, (_, file) => {
            cb(path.join(p, file))
          })
        } else if (pattern.test(p)) {
          e.emit('_modified', p)
        }
      }
    })
  }

  const readDirs = (p, store) => {
    const files = fs.readdirSync(p)
    const fileslen = files.length

    for (var i = 0; i < fileslen; i++) {
      const d = path.join(p, files[i])
      const stats = fs.lstatSync(d)

      if (stats.isDirectory()) {
        readDirs(d, store)
        dirs.push(d)
      }
    }
  }

  const watch = dirs => {
    let dirslen = dirs.length
    for (let i = 0; i < dirslen; i++) (loc => {
      fs.watch(loc, (_, file) => {
        cb(path.join(loc, file))
      })
    })(dirs[i])
  }

  readDirs(opts.dir, dirs)
  watch(dirs)

  e.addDir = p => {
    let _dirs = []
    readDirs(p, _dirs)
    watch(_dirs)
    dirs = dirs.concat(_dirs)
  }

  return e
}

