# SYNOPSIS
A simple cross platform leveldb backed file system watcher.

# DESCRIPTION
Watches the file system recursively, stores a snapshot in leveldb, compares
and emits changes in the form of new-line-delimited json. Also emits events
for changes made since the process was last run.

# USAGE

### fsch(1)
Used as a user command.

```bash
fsch <path/to/watch> <regex-pattern> [path/to/cache]
```

### fs-changes(3)
Used as a library.

```js
const changes = require('fs-changes')

const opts = {
  pattern: /\.txt$/,
  dir: './files',
  cache: '.cache'
}

changes(opts, events => { // returns `events` after doing initial diff

  events.on('added', path => console.log({ path, type: 'added' }))
  events.on('modified', path => console.log({ path, type: 'modified' }))
  events.on('removed', path => console.log({ path, type: 'removed' }))
}) // returns an instance of levelup
```

