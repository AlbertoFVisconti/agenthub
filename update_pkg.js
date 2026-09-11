const fs = require("fs");
let pkg = JSON.parse(fs.readFileSync("electron/package.json", "utf8"));
delete pkg.build.asar;
fs.writeFileSync("electron/package.json", JSON.stringify(pkg, null, 2));
