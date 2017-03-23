'use strict'
const fs = require('fs')
const path = require('path')
const level = require('levelup')
const Watch = require('./watch')

const defaultPath = path.join(__dirname, '.cache')

module.exports = function (opts, cb) {
  const cache = level(opts.cache || defaultPath, opts)

  let paused = !!opts.paused
  let watch = Watch(opts)

  cache.on('pause', () => {
    paused = true
  })

  cache.on('resume', () => {
    paused = false
    cache.emit('resumed')
  })

  cache.remove = (filepaths, cb) => {
    paused = true

    if (!filepaths.length) return

    filepaths = filepaths.map(p => {
      return { type: 'del', key: p }
    })

    cache.batch(filepaths, cb)
  }

  cache.add = (filepaths, cb) => {
    paused = true

    if (!filepaths.length) return

    filepaths = filepaths.map(p => {
      return { type: 'put', key: p, value: '' }
    })

    cache.batch(filepaths, cb)
  }

  const readFiles = (dir, done) => {
    fs.readdir(dir, (err, list) => {
      if (err) return done(err)
      let i = 0

      ;(function next () {
        let file = list[i++]
        if (!file) return done(null)
        let filepath = path.join(dir, file)

        fs.stat(filepath, (err, stat) => {
          if (err) return done(err)

          if (stat && stat.isDirectory()) {
            return readFiles(filepath, next)
          } else if (!opts.pattern.test(file)) {
            return next()
          }

          cache.get(filepath, (err, value) => {
            if (!err) return next()

            cache.put(filepath, '', (err) => {
              if (err) return cb(err)

              if (paused) return next()

              watch.emit('added', filepath)
              next()
            })
          })
        })
      })()
    })
  }

  const ready = () => {
    const removed = (p, isDirectory) => {
      if (paused) return

      if (isDirectory) {
        const rs = cache
            .createReadStream({
              gte: p,
              lte: p + '~',
              values: false
            })

        rs.on('data', key => {
          cache.get(key, (err) => {
            if (err) return
            cache.del(key, (err) => {
              if (err) return
              watch.emit('removed', key)
            })
          })
        })
      } else {
        cache.del(p, (err) => {
          if (err) return
          watch.emit('removed', p)
        })
      }
    }

    const modified = (p, isDirectory) => {
      if (paused) return

      if (isDirectory) {
        watch.addDir(p)
        return readFiles(p, (err) => {
          if (err) watch.emit('error', err)
        })
      }

      cache.get(p, err => {
        if (!err) return watch.emit('modified', p)

        cache.put(p, '', err => {
          if (err) return watch.emit('error', err)

          watch.emit('added', p)
        })
      })
    }

    watch.on('_removed', removed)
    watch.on('_modified', modified)
  }

  let waiting = 0

  cache
    .createReadStream({ values: false })
    .on('data', key => {
      ++waiting

      // check to see if the file that we know about exists,
      // if not, complain that it has been deleted from the
      // watched directory. Unless the watcher starts in the
      // "paused" state.

      fs.stat(key, (err, _) => {
        if (!err) {
          --waiting
          return
        }

        cache.del(key, (err) => {
          --waiting
          if (err) return watch.emit('error', err)
          if (!paused) watch.emit('removed', key)
        })
      })
    })
    .on('end', () => {
      let wait = setInterval(() => {
        if (!waiting) {
          clearInterval(wait)
          watch.emit('ready')
          readFiles(opts.dir, ready)
        }
      }, 100)
    })

  process.nextTick(() => cb(null, watch))
  return cache
}
