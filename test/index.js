'use strict'
const fs = require('fs')
const path = require('path')
const spawn = require('child_process').spawn

const test = require('tape')
const split = require('split2')
const through = require('through2')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')

const cacheFile = path.join(__dirname, '/../.test.json')
const fixtures = path.join(__dirname, '/fixtures')

test('setup', assert => {
  rimraf.sync(fixtures)
  rimraf.sync(cacheFile)
  mkdirp.sync(fixtures)
  assert.end()
})

test('observe changes in a target directory', assert => {

  const args = [fixtures, '"\\.(txt)$"', cacheFile]
  const fsch = spawn('bin/fsch', args)

  let ops = []

  let s = fsch.stdout
    .pipe(split(JSON.parse))
    .pipe(through.obj(function(op, _, cb) {
      ops.push(op)
      cb()
    }))

  const p = path.join(fixtures, '/a.txt')
  const data = ' '

  const done = () => {
    assert.equal(ops[0].type, 'added')
    assert.equal(ops[1].type, 'modified')
    assert.equal(ops[2].type, 'removed')
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
          }, 128)
        })
      }, 128)
    })
  }, 128)

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

    const args = [fixtures, '"\\.(txt)$"', cacheFile]
    const fsch = spawn('bin/fsch', args)

    let s = fsch.stdout
    .pipe(split(JSON.parse))
    .pipe(through.obj(function(op, _, cb) {
      ops.push(op)
      if (ops.length === 2) {
        setTimeout(() => {
          assert.equal(ops[0].type, 'added')
          assert.equal(ops[1].type, 'added')
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

    assert.comment('also put some files in the new directory')

    fs.writeFileSync(path.join(p, '/a.txt'), ' ')
    fs.writeFileSync(path.join(p, '/b.txt'), ' ')

    setTimeout(() => {

      assert.comment('start fs-changes')

      const args = [fixtures, '"\\.(txt)$"', cacheFile]
      const fsch = spawn('bin/fsch', args)
      const ops = []

      let s = fsch.stdout
        .pipe(split(JSON.parse))
        .pipe(through.obj(function(op, _, cb) {
          ops.push(op)
          cb()
        }))

      setTimeout(() => {
        rimraf(p, err => {
          assert.ok(!err)
          setTimeout(() => {
            assert.equal(ops[0].type, 'added')
            assert.equal(ops[1].type, 'added')
            assert.equal(ops[2].type, 'removed')
            assert.equal(ops[3].type, 'removed')
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

