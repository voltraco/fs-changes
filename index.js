'use strict'
const fs = require('fs')
const path = require('path')
const level = require('level')
const Watch = require('./watch')

const defaultPath = path.join(__dirname, '.cache')

module.exports = function (opts, cb) {
  const cache = level(opts.cache || defaultPath)

  let watch = Watch(opts)

  const readFiles = (p, cb) => {
    fs.readdir(p, (err, files) => {
      if (err) return cb(err)

      const next = file => {
        if (!file) {
          return cb(null)
        }

        const f = path.join(p, file)
        const stats = fs.lstatSync(f)

        if (stats.isDirectory()) {
          readFiles(f, cb)
        } else if (opts.pattern.test(f)) {
          cache.get(f, (err, value) => {
            if (!err) {
              return next(files.pop())
            }

            cache.put(f, null, (err) => {
              if (err) return cb(err)

              watch.emit('added', f)

              next(files.pop())
            })
          })
        }
      }

      next(files.pop())
    })
  }

  const ready = () => {
    const removed = (p, isDirectory) => {
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
              if (err) return watch.emit('error', err)

              watch.emit('removed', key)
            })
          })
        })
      } else {
        cache.del(p, (err) => {
          if (err) return watch.emit('error', err)
          watch.emit('removed', p)
        })
      }
    }

    const modified = (p, isDirectory) => {
      if (isDirectory) {
        watch.addDir(p)
        return readFiles(p, (err) => {
          if (err) watch.emit('error', err)
        })
      }

      cache.get(p, err => {
        if (!err) return watch.emit('modified', p)

        cache.put(p, null, err => {
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
      fs.stat(key, (err, _) => {
        if (!err) {
          --waiting
          return
        }

        cache.del(key, (err) => {
          --waiting
          if (err) return watch.emit('error', err)
          watch.emit('removed', key)
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

  cb(null, watch)
}

