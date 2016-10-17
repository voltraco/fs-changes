'use strict'
const fs = require('fs')
const path = require('path')
const events = require('events')

module.exports = function Watch (opts) {
  opts = opts || {}
  const pattern = opts.pattern

  if (typeof opts.dir === 'undefined') {
    throw new Error('dir parameter required')
  }

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

  const readDirs = (dir, done) => {
    if (!dir) return
    fs.readdir(dir, (err, files) => {
      if (err) return done(err)

      let i = 0

      ;(function next () {
        let file = files[i++]
        if (!file) return done(null)

        const filepath = path.join(dir, file)
        fs.stat(filepath, (err, stat) => {
          if (err) return done(err)

          if (stat && stat.isDirectory()) {
            dirs[filepath] = null
            return readDirs(filepath, next)
          }
          next()
        })
      }())
    })
  }

  const watch = err => {
    if (err) return e.emit('error', err)
    Object.keys(dirs).map(loc => {
      if (dirs[loc]) return
      dirs[loc] = fs.watch(loc, (_, file) => {
        cb(path.join(loc, file))
      })
    })
  }

  readDirs(opts.dir, watch)

  e.addDir = p => readDirs(p, watch)

  return e
}

