'use strict'
const fs = require('fs')
const path = require('path')
const spawn = require('child_process').spawn

const test = require('tape')
const split = require('split2')
const through = require('through2')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')

const cache = path.join(__dirname, '/../.cache')
const fixtures = path.join(__dirname, '/fixtures')

test('setup', assert => {
  rimraf.sync(fixtures)
  rimraf.sync(cache)
  mkdirp.sync(fixtures)
  assert.end()
})

test('observe ready event', assert => {
  const args = [fixtures, '"\\.(txt)$"', cache]
  const fsch = spawn('bin/fsch', args)

  fsch.stdout
    .pipe(split(JSON.parse))
    .pipe(through.obj(function (op, _, cb) {
      assert.equal(op.type, 'ready')
      fsch.kill()
    }))

  fsch.on('close', () => {
    assert.end()
  })
})

test('observe changes in a target directory', assert => {
  const args = [fixtures, '"\\.(txt)$"', cache]
  const fsch = spawn('bin/fsch', args)

  let ops = []

  fsch.stdout
    .pipe(split(JSON.parse))
    .pipe(through.obj(function (op, _, cb) {
      ops.push(op)
      cb()
    }))

  const p = path.join(fixtures, '/a.txt')
  const data = ' '

  const done = () => {
    assert.equal(ops.length, 4)
    console.log(ops)
    assert.comment('All three activities were observed')
    fsch.kill()
  }

  setTimeout(() => {
    fs.writeFile(p, data, () => {
      setTimeout(() => {
        fs.writeFile(p, data, () => {
          setTimeout(() => {
            fs.unlink(p, () => {
              setTimeout(done, 128)
            })
          }, 1000)
        })
      }, 1000)
    })
  }, 1000)

  fsch.on('close', code => {
    assert.end()
  })
})

test('get changes since the last run when starting', assert => {
  assert.comment('write two new files while fs-changes isnt watching')

  fs.writeFileSync(fixtures + '/b.txt', ' ')
  fs.writeFileSync(fixtures + '/c.txt', ' ')

  let ops = []

  setTimeout(() => {
    assert.comment('start fs-changes')

    const args = [fixtures, '"\\.(txt)$"', cache]
    const fsch = spawn('bin/fsch', args)
    let adds = 0

    fsch.stdout
      .pipe(split(JSON.parse))
      .pipe(through.obj(function (op, _, cb) {
        if (op.type === 'added') ++adds
        ops.push(op)

        if (ops.length === 3) {
          setTimeout(() => {
            assert.equal(adds, 2)
            assert.comment('two new files were added')
            fsch.kill()
          }, 128)
        }
        cb()
      }))

    fsch.on('close', code => {
      assert.end()
    })
  }, 128)
})

test('directories that are added are watched', assert => {
  const p = path.join(fixtures, 'quxx')

  assert.comment('create a new directory while fs-changes isnt watching')

  mkdirp(p, (err) => {
    assert.ok(!err)

    assert.comment('put some new files in the new directory')

    fs.writeFileSync(path.join(p, '/a.txt'), ' ')
    fs.writeFileSync(path.join(p, '/b.txt'), ' ')

    setTimeout(() => {
      assert.comment('start fs-changes')

      const args = [fixtures, '"\\.(txt)$"', cache]
      const fsch = spawn('bin/fsch', args)
      const ops = []
      let adds = 0
      let removes = 0
      let ready = 0

      fsch.stdout
        .pipe(split(JSON.parse))
        .pipe(through.obj(function (op, _, cb) {
          if (op.type === 'added') ++adds
          if (op.type === 'removed') ++removes
          if (op.type === 'ready') ++ready
          ops.push(op)
          cb()
        }))

      setTimeout(() => {
        rimraf(p, err => {
          assert.ok(!err)
          setTimeout(() => {
            console.log(ops)
            assert.equal(adds, 2)
            assert.equal(removes, 2)
            assert.equal(ready, 1)
            fsch.kill()
          }, 512)
        })
      }, 512)

      fsch.on('close', code => {
        assert.end()
      })
    }, 512)
  })
})
