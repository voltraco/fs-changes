'use strict'
const fs = require('fs')
const path = require('path')
const diff = require('./diff')
const Watch = require('./watch')

const concat = [].concat

module.exports = function(opts, cb) {

  if (path.extname(opts.cacheFilename) !== '.json') {
    return cb(new Error('Cache must be a .json file'))
  }

  let previous = []
  let current = []

  const readFiles = (p, store) => {
    const files = fs.readdirSync(p)
    const fileslen = files.length;

    for (var i = 0; i < fileslen; i++) {
      const f = path.join(p, files[i])
      const stats = fs.lstatSync(f)

      if (stats.isDirectory())
        readFiles(f, store)
      else if (opts.pattern.test(files[i]))
        store.push(f)
    }
  }

  let debounce
  const updateCache = () => {
    clearTimeout(debounce)
    debounce = setTimeout(() => {
      fs.writeFileSync(
        opts.cacheFilename,
        JSON.stringify(current))
    }, 1)
  }

  const ready = delta => {
    updateCache()

    let watch = Watch(opts)

    const removed = (p, isDirectory) => {
      if (isDirectory) {
        let len = current.length
        let i = len
        while (--i) {
          if (current[i].indexOf(p) > -1) {
            let r = current.splice(i, 1)
            watch.emit('removed', r[0])
          }
        }
        updateCache()
        return
      }

      const index = current.indexOf(p)
      if (index > -1) {
        current.splice(index, 1)
      }
      watch.emit('removed', p)
      updateCache()
    }

    const modified = (p, isDirectory) => {
      if (isDirectory) {
        watch.addDir(p)
        let _current = []
        readFiles(p, _current)
        _current.forEach(f => watch.emit('added', f))
        current = current.concat(_current)
      } else if (current.indexOf(p) === -1) {
        current.push(p)
        watch.emit('added', p)
      } else {
        watch.emit('modified', p)
      }
      updateCache()
    }

    watch.on('_removed', removed)
    watch.on('_modified', modified)

    cb(null, watch)

    if (delta && delta.added.length) {
      delta.added.forEach(p => {
        watch.emit('added', p)
      })
      updateCache()
    }

    if (delta && delta.removed.length) {
      delta.removed.map(removed)
    }
  }

  try {
    previous = require(opts.cacheFilename)
  } catch(err) {
    fs.writeFileSync(opts.cacheFilename, '', 'utf8')
  }

  readFiles(opts.dir, current)

  if (JSON.stringify(previous) === 
      JSON.stringify(current)) {
    return ready()
  }

  diff(previous, current, ready)
}

