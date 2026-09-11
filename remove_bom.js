const fs = require('fs');
const path = require('path');

function walk(dir, done) {
  let results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    let i = 0;
    (function next() {
      let file = list[i++];
      if (!file) return done(null, results);
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          if (!file.includes('node_modules') && !file.includes('.git')) {
            walk(file, function(err, res) {
              results = results.concat(res);
              next();
            });
          } else {
            next();
          }
        } else {
          if (file.endsWith('.json')) results.push(file);
          next();
        }
      });
    })();
  });
};

walk('.', function(err, results) {
  if (err) throw err;
  results.forEach(file => {
    let content = fs.readFileSync(file);
    if (content[0] === 0xef && content[1] === 0xbb && content[2] === 0xbf) {
      console.log('Found BOM in:', file);
      fs.writeFileSync(file, content.slice(3));
    }
  });
});
