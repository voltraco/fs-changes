# SYNOPSIS
Watch the file system recursively and emit changes as new-line-delimited json.
Emits events for changes made since the process was last run.

# USAGE

### fsch(1)
Used as a user command.

```bash
fsch <path/to/directory> <regex-pattern> [cache.json]
```

### fsch(3)
Used as a library.

```js
const f = require('fsch')

const opts = {
  pattern: /\.txt$/,
  dir: dir,
  cacheFilename: __dirname
}

f(opts, events => { // returns `events` after doing initial diff

  events.on('added', p => console.log({ path: p, type: 'added' }))
  events.on('modified', p => console.log({ path: p, type: 'modified' }))
  events.on('removed', p => console.log({ path: p, type: 'removed' }))
})
```

