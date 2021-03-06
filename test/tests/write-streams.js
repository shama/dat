var fs = require('fs')
var path = require('path')
var os = require('os')
var crypto = require('crypto')
var mbstream = require('multibuffer-stream')
var buff = require('multibuffer')
var bops = require('bops')
var protobuf = require('protocol-buffers')
var concat = require('concat-stream')
var debug = require('debug')('test.write-streams')

module.exports.blobWriteStream = function(test, common) {
  test('piping a blob into a blob write stream', function(t) {
    common.getDat(t, function(dat, done) {
      
      var ws = dat.createBlobWriteStream('write-streams.js', function(err, doc) {
        t.notOk(err, 'no blob write err')
        var attachment = doc.attachments['write-streams.js']
        t.ok(attachment, 'doc has attachment')
        t.ok(attachment.size, 'attachment has size')
        t.ok(attachment.hash, 'attachment has hash')
        done()
      })
      
      fs.createReadStream(path.join(__dirname, 'write-streams.js')).pipe(ws)
    })
  })
}

module.exports.blobReadStream = function(test, common) {
  test('getting a blob read stream by row key + name', function(t) {
    common.getDat(t, function(dat, done) {
      
      var ws = dat.createBlobWriteStream('write-streams.js', function(err, doc) {
        t.notOk(err, 'no blob write err')
        var attachment = doc.attachments['write-streams.js']
        t.ok(attachment, 'doc has attachment')

        var rs = dat.createBlobReadStream(doc.key, 'write-streams.js')

        rs.on('error', function(e) {
          t.false(e, 'no read stream err')
          done()
        })

        rs.pipe(concat(function(file) {
          t.equal(file.length, attachment.size, 'attachment size is correct')
          done()
        }))
      })
      
      fs.createReadStream(path.join(__dirname, 'write-streams.js')).pipe(ws)
    })
  })
}


module.exports.blobExists = function(test, common) {
  test('check if a blob exists in the local blob store', function(t) {
    common.getDat(t, function(dat, done) {
      var ws = dat.createBlobWriteStream('write-streams.js', function(err, doc) {
        t.notOk(err, 'no blob write err')
        dat.blobs.backend.exists(doc.attachments['write-streams.js'].hash, function(err, exists) {
          t.ok(exists, 'blob exists')
          dat.blobs.backend.exists('not-a-valid-hash', function(err, exists) {
            t.notOk(exists, 'invalid hash does not exist')
            done()
          })
        })
      })
      fs.createReadStream(path.join(__dirname, 'write-streams.js')).pipe(ws)
    })
  })
}

module.exports.singleNdjsonObject = function(test, common) {
  test('piping a single ndjson object into a write stream', function(t) {
    common.getDat(t, function(dat, done) {

      var ws = dat.createWriteStream({ json: true, quiet: true })

      ws.on('end', function() {
    
        var cat = dat.createReadStream()
    
        cat.pipe(concat(function(data) {
          t.equal(data.length, 1)
          t.equal(data[0].value.batman, "bruce wayne")
          done()
        }))
      })
    
      ws.write(bops.from(JSON.stringify({"batman": "bruce wayne"})))
      ws.end()
    })
  })
}

module.exports.singleNdjsonString = function(test, common) {
  test('piping a single ndjson string into a write stream', function(t) {
    common.getDat(t, function(dat, done) {
    
      var ws = dat.createWriteStream({ json: true, quiet: true })
    
      ws.on('end', function() {
    
        var cat = dat.createReadStream()
      
        cat.pipe(concat(function(data) {
          t.equal(data.length, 1)
          t.equal(data[0].value.batman, "bruce wayne")
          done()
        }))
      
      })
    
      ws.write(JSON.stringify({"batman": "bruce wayne"}))
      ws.end()
    })
  })
}

module.exports.multipleNdjsonObjects = function(test, common) {
  test('piping multiple ndjson objects into a write stream', function(t) {
    common.getDat(t, function(dat, done) {
    
      var ws = dat.createWriteStream({ json: true, quiet: true })
    
      ws.on('end', function() {
      
        var cat = dat.createReadStream()
      
        cat.pipe(concat(function(data) {
          debug('data', data)
          t.equal(data.length, 2)
          t.equal(data[0].value.foo, "bar")
          t.equal(data[1].value.foo, "baz")
          done()
        }))
      
      })
    
      ws.write(bops.from(JSON.stringify({"foo": "bar"}) + os.EOL))
      ws.write(bops.from(JSON.stringify({"foo": "baz"})))
      ws.end()
    
    })
  })
}


module.exports.singleNdjsonObjectKeyOnly = function(test, common) {
  test('piping a single ndjson object w/ only key into a write stream', function(t) {
    common.getDat(t, function(dat, done) {
    
      var ws = dat.createWriteStream({ json: true, quiet: true })
    
      ws.on('end', function() {
        var cat = dat.createReadStream()
        cat.pipe(concat(function(data) {
          debug('data', data)
          t.equal(data.length, 1)
          t.equal(data[0].key, "foo")
          done()
        }))
      })
    
      ws.write(bops.from(JSON.stringify({"key": "foo"})))
      ws.end()
    })
  })
}

module.exports.singleBuff = function(test, common) {
  test('piping a single row of buff data with write stream', function(t) {
  
    var schema = protobuf([{name:'foo', type:'json'}])
    var row = schema.encode({foo:'bar'})
  
    common.getDat(t, function(dat, done) {
    
      var ws = dat.createWriteStream({ columns: ['foo'], protobuf: true, quiet: true })
    
      ws.on('end', function() {
        dat.createReadStream().pipe(concat(function(data) {
          t.equal(data.length, 1)
          t.equal(data[0].value.foo, 'bar')
          done()
        }))
      })
    
      var packStream = mbstream.packStream()
      packStream.pipe(ws)
      packStream.write(row)
      packStream.end()
    
    })
  })
}

module.exports.multipleBuffs = function(test, common) {
  test('piping multiple rows of buff data with write stream', function(t) {

    var schema = protobuf([{name:'a', type:'json'}, {name:'b', type:'json'}])
    var row1 = schema.encode({a:'1',b:'2'})
    var row2 = schema.encode({a:'3',b:'4'})

    common.getDat(t, function(dat, done) {
    
      var ws = dat.createWriteStream({ columns: ['a', 'b'], protobuf: true, quiet: true })
      ws.on('end', function() {
        dat.createReadStream().pipe(concat(function(data) {
          t.equal(data.length, 2)
          t.equal(data[0].value.a, '1')
          t.equal(data[0].value.b, '2')
          t.equal(data[1].value.a, '3')
          t.equal(data[1].value.b, '4')
          done()
        }))
      })
    
      var packStream = mbstream.packStream()
      packStream.pipe(ws)
      packStream.write(row1)
      packStream.write(row2)
      packStream.end()
    
    })
  })
}

module.exports.csvOneRow = function(test, common) {
  test('piping a csv with 1 row into a write stream', function(t) {
    common.getDat(t, function(dat, done) {
    
      var ws = dat.createWriteStream({ csv: true, quiet: true })
    
      ws.on('end', function() {
        var cat = dat.createReadStream()
        cat.pipe(concat(function(data) {
          t.equal(data.length, 1)
          t.equal(data[0].value.a, '1')
          t.equal(data[0].value.b, '2')
          t.equal(data[0].value.c, '3')
          done()
        }))
      })
    
      ws.write(bops.from('a,b,c\n1,2,3'))
      ws.end()
    
    })
  })
}

module.exports.csvMultipleRows = function(test, common) {
  test('piping a csv with multiple rows into a write stream', function(t) {
    common.getDat(t, function(dat, done) {
    
      var ws = dat.createWriteStream({ csv: true, quiet: true })
    
      ws.on('end', function() {
        var cat = dat.createReadStream()
        cat.pipe(concat(function(data) {
          t.equal(data.length, 2)
          t.equal(data[0].value.a, '1')
          t.equal(data[0].value.b, '2')
          t.equal(data[0].value.c, '3')
          t.equal(data[1].value.a, '4')
          t.equal(data[1].value.b, '5')
          t.equal(data[1].value.c, '6')
          done()
        }))
      })
    
      ws.write(bops.from('a,b,c\n1,2,3\n4,5,6'))
      ws.end()
    
    })
  })
}

module.exports.csvCustomDelimiter = function(test, common) {
  test('piping a csv with multiple rows + custom delimiter into a write stream', function(t) {
    common.getDat(t, function(dat, done) {
    
      var ws = dat.createWriteStream({ csv: true, separator: '\t', quiet: true })
    
      ws.on('end', function() {
        var cat = dat.createReadStream()
        cat.pipe(concat(function(data) {
          t.equal(data.length, 2)
          t.equal(data[0].value.a, '1')
          t.equal(data[0].value.b, '2')
          t.equal(data[0].value.c, '3')
          t.equal(data[1].value.a, '4')
          t.equal(data[1].value.b, '5')
          t.equal(data[1].value.c, '6')
          done()
        }))
      })
    
      ws.write(bops.from('a\tb\tc\n1\t2\t3\n4\t5\t6'))
      ws.end()
    
    })
  })
}

module.exports.multipleWriteStreams = function(test, common) {
  test('multiple writeStreams, updating rows', function(t) {
    common.getDat(t, function(dat, done) {
    
      var ws = dat.createWriteStream({ csv: true, quiet: true })
    
      ws.on('end', function() {
        var cat = dat.createReadStream()
        cat.pipe(concat(function(data) {
          var jws = dat.createWriteStream({ json: true, quiet: true })
          jws.on('end', function() {
            var cat = dat.createReadStream()
            cat.pipe(concat(function(data2) {

              t.equal(data.length, data2.length)
              done()
            }))
          })
          jws.write(bops.from(JSON.stringify(data[0].value) + os.EOL))
          jws.write(bops.from(JSON.stringify(data[1].value)))
          jws.end()
        }))
      })
    
      ws.write(bops.from('a,b,c\n1,2,3\n4,5,6'))
      ws.end()
    
    })
  })
}

module.exports.multipleWriteStreamsUpdatingChanged = function(test, common) {
  test('multiple writeStreams w/ updating data + primary key only updates rows that changed', function(t) {
    common.getDat(t, function(dat, done) {
      var ws1 = dat.createWriteStream({ json: true, primary: 'foo', quiet: true })
  
      ws1.on('end', function() {
        var ws2 = dat.createWriteStream({ json: true, primary: 'foo', quiet: true })
        
        ws2.on('conflict', function(e) {
          t.ok(e, 'should conflict')
          var cat = dat.createReadStream()
  
          cat.pipe(concat(function(data) {
            t.equal(data.length, 1)
            t.equal(data[0].value.foo, "bar")
            done()
          }))
        })

        ws2.write(bops.from(JSON.stringify({"foo": "bar"})))
        ws2.end()
      })
  
      ws1.write(bops.from(JSON.stringify({"foo": "bar"})))
      ws1.end()
  
    })
  })
}

module.exports.compositePrimaryKey = function(test, common) {
  test('composite primary key', function(t) {
    common.getDat(t, function(dat, done) {
      var ws = dat.createWriteStream({ primary: ['a', 'b'], quiet: true })
    
      ws.on('end', function() {
        dat.get('foobar', function(err, data) {
          t.false(err, 'no error')
          t.equal(data.c, "hello")
          done()
        })
      })
    
      ws.write({"a": "foo", "b": "bar", "c": "hello"})
      ws.end()
    })
  })
}

module.exports.compositePrimaryKeyCustomSeparator = function(test, common) {
  test('composite primary key w/ custom keySeparator', function(t) {
    common.getDat(t, function(dat, done) {
      var ws = dat.createWriteStream({ primary: ['a', 'b'], separator: '@', quiet: true })
    
      ws.on('end', function() {
        dat.get('foo@bar', function(err, data) {
          t.false(err, 'no error')
          t.equal(data.c, "hello")
          done()
        })
      })
    
      ws.write({"a": "foo", "b": "bar", "c": "hello"})
      ws.end()
    })
  })
  
}

module.exports.compositePrimaryKeyHashing = function(test, common) {
  test('composite primary key w/ composite hashing enabled', function(t) {
    common.getDat(t, function(dat, done) {
      var ws = dat.createWriteStream({ primary: ['a', 'b'], hash: true, quiet: true })
    
      ws.on('end', function() {
        var key = crypto.createHash('md5').update('foobar').digest("hex")

        dat.get(key, function(err, data) {
          t.false(err, 'no error')
          t.equal(data.c, "hello")
          done()
        })
      })
    
      ws.write({"a": "foo", "b": "bar", "c": "hello"})
      ws.end()
    })
  })
}

module.exports.compositePrimaryKeySeparator = function(test, common) {
  test('composite primary key w/ custom separator', function(t) {
    common.getDat(t, function(dat, done) {
      var ws = dat.createWriteStream({ primary: ['a', 'b'], separator: '-', quiet: true })
    
      ws.on('end', function() {

        dat.get('foo-bar', function(err, data) {
          t.false(err, 'no error')
          t.equal(data.c, "hello")
          done()
        })
      })
    
      ws.write({"a": "foo", "b": "bar", "c": "hello"})
      ws.end()
    })
  })
}

module.exports.primaryKeyFunction = function(test, common) {
  test('primary key function', function(t) {
    common.getDat(t, function(dat, done) {
      var ws = dat.createWriteStream({primaryFormat: function () { return 'P-Funk' }, quiet: true})

      ws.on('end', function() {
        dat.get('P-Funk', function(err, data) {
          t.notOk(err, 'no error')
          t.equal(data.a, 'foo')
          done()
        })
      })

      ws.write({'a': 'foo'})
      ws.end()
    })
  })
}

module.exports.primaryKeyFunctionUsingPrimaryVal = function(test, common) {
  test('primary key function', function(t) {
    common.getDat(t, function(dat, done) {
      var ws = dat.createWriteStream({primary: 'a', primaryFormat: function (val) { return 'P-' + val }, quiet: true})

      ws.on('end', function() {
        dat.get('P-Funk', function(err, data) {
          t.notOk(err, 'no error')
          t.equal(data.a, 'Funk')
          done()
        })
      })

      ws.write({'a': 'Funk'})
      ws.end()
    })
  })
}


module.exports.writeStreamConflicts = function(test, common) {
  test('csv writeStream w/ conflicting updates', function(t) {
    common.getDat(t, function(dat, done) {
      
      function writeAndVerify(obj, cb) {
        var ws = dat.createWriteStream({quiet: true})

        var conflicted
        
        ws.on('end', function() {
          if (conflicted) return
          var cat = dat.createValueStream()
          cat.pipe(concat(function(data) {
            cb(null, data)
          }))
        })
        
        ws.on('conflict', function(e) {
          conflicted = true
          cb(e)
        })
    
        ws.write(obj)
        ws.end()
      }
      
      var ver1 = {key: 'foo', 'name': 'bob'}
      
      writeAndVerify(ver1, function(err1, stored1) {
        t.notOk(err1, 'no err')
        t.equals(stored1.length, 1, '1 row in db')
        t.equals(stored1[0].name, 'bob', 'bob is in db')
        t.equals(stored1[0].version, 1, 'bob is at ver 1')
        writeAndVerify(ver1, function(err2, stored2) {
          t.ok(err2, 'should have conflicted')
          t.equals(stored1.length, 1, '1 row in db')
          t.equals(stored1[0].name, 'bob', 'bob is in db')
          t.equals(stored1[0].version, 1, 'bob is at ver 1')
          writeAndVerify(stored1[0], function(err3, stored3) {
            t.notOk(err3, 'no err')
            t.equals(stored3.length, 1, '1 row in db')
            t.equals(stored3[0].name, 'bob', 'bob is in db')
            t.equals(stored3[0].version, 2, 'bob is at ver 2')
            done()
          })
        })
      })
    
    })
  })
}


module.exports.writeStreamCsvNoHeaderRow = function(test, common) {
  test('csv writeStream w/ headerRow false', function(t) {
    common.getDat(t, function(dat, done) {
    
      var ws = dat.createWriteStream({ csv: true, columns: ['foo'], headerRow: false, quiet: true })
    
      ws.on('end', function() {
        var cat = dat.createReadStream()
        cat.pipe(concat(function(data) {
          t.equal(data.length, 1)
          t.equal(data[0].value.foo, 'bar')
          done()
        }))
      })
    
      ws.write(bops.from('bar'))
      ws.end()
    
    })
  })
}

module.exports.writeStreamMultipleWithRandomKeys = function(test, common) {
  test('writeStream same json multiple times (random key generation)', function(t) {
    common.getDat(t, function(dat, done) {
      var ws1 = dat.createWriteStream({ json: true, quiet: true })
    
      ws1.on('end', function() {
        var ws2 = dat.createWriteStream({ json: true, quiet: true })
      
        ws2.on('end', function() {
          var cat = dat.createReadStream()
    
          cat.pipe(concat(function(data) {
            t.equal(data.length, 2)
            t.equal(data[0].value.foo, "bar")
            t.equal(data[1].value.foo, "bar")
            done()
          }))
        })
      
        ws2.write(bops.from(JSON.stringify({"foo": "bar"})))
        ws2.end()
      })
    
      ws1.write(bops.from(JSON.stringify({"foo": "bar"})))
      ws1.end()
    
    })
  })
}

module.exports.multipleCSVWriteStreamsChangingSchemas = function(test, common) {
  test('multiple CSV writeStreams w/ different schemas', function(t) {
    common.getDat(t, function(dat, done) {
      var ws1 = dat.createWriteStream({ csv: true, quiet: true })
  
      ws1.on('end', function() {
        var ws2 = dat.createWriteStream({ csv: true, quiet: true })

        ws2.on('error', function(e) {
          t.equal(e.type, 'columnMismatch', 'column mismatch')
          done()
        })
        
        ws2.write(bops.from('d,e,f\nfoo,bar,baz'))
        ws2.end()
      })
  
      ws1.write(bops.from('a,b,c\n1,2,3\n4,5,6'))
      ws1.end()
    })
  })
}

module.exports.keepTotalRowCount = function(test, common) {
  test('keeps row count for streams', function(t) {
    common.getDat(t, function(dat, done) {

      var ws = dat.createWriteStream({ csv: true, quiet: true })

      ws.on('end', function() {
        var cat = dat.createReadStream()
        cat.pipe(concat(function(data) {
          t.equal(dat.getRowCount(), 2)
          done()
        }))
      })

      ws.write(bops.from('a,b,c\n1,2,3\n4,5,6'))
      ws.end()

    })
  })

  test('keeps row count for streams after updates', function(t) {
    common.getDat(t, function(dat, done) {
      var ws1 = dat.createWriteStream({ json: true, quiet: true })

      ws1.on('end', function() {
        var ws2 = dat.createWriteStream({ json: true, quiet: true })

        ws2.on('conflict', function(e) {
          var cat = dat.createReadStream()

          cat.pipe(concat(function(data) {
            t.equal(data.length, 1)
            t.equal(dat.getRowCount(), 1)
            done()
          }))
        })

        ws2.write(bops.from(JSON.stringify({'key': 'foo'})))
        ws2.end()
      })

      ws1.write(bops.from(JSON.stringify({'key': 'foo'})))
      ws1.end()

    })
  })
}

module.exports.all = function (test, common) {
  module.exports.blobWriteStream(test, common)
  module.exports.blobReadStream(test, common)
  module.exports.blobExists(test, common)
  module.exports.singleNdjsonObject(test, common)
  module.exports.singleNdjsonString(test, common)
  module.exports.multipleNdjsonObjects(test, common)
  module.exports.singleNdjsonObjectKeyOnly(test, common)
  module.exports.singleBuff(test, common)
  module.exports.multipleBuffs(test, common)
  module.exports.csvOneRow(test, common)
  module.exports.csvMultipleRows(test, common)
  module.exports.csvCustomDelimiter(test, common)
  module.exports.multipleWriteStreams(test, common)
  module.exports.multipleWriteStreamsUpdatingChanged(test, common)
  module.exports.compositePrimaryKey(test, common)
  module.exports.compositePrimaryKeyCustomSeparator(test, common)
  module.exports.compositePrimaryKeyHashing(test, common)
  module.exports.compositePrimaryKeySeparator(test, common)
  module.exports.primaryKeyFunction(test, common)
  module.exports.primaryKeyFunctionUsingPrimaryVal(test, common)
  module.exports.writeStreamConflicts(test, common)
  module.exports.writeStreamCsvNoHeaderRow(test, common)
  module.exports.writeStreamMultipleWithRandomKeys(test, common)
  module.exports.multipleCSVWriteStreamsChangingSchemas(test, common)
  module.exports.keepTotalRowCount(test, common)
}
