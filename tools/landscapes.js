const landscapesInfo = require('js-yaml').safeLoad(require('fs').readFileSync('landscapes.yml'));

async function main() {
  for (var landscape of landscapesInfo.landscapes) {
    console.info(`processing ${landscape.name} at ${landscape.repo}`);
    const settingsFileName = `${process.env.HOME}/${landscape.name}.env`
    if (!require('fs').existsSync(settingsFileName)) {
      console.info(`Warning: settings file ${settingsFileName} for ${landscape.name} does not exist, we will not be able to report to slack`);
    };
    const globalSettingsFileName = `${process.env.HOME}/landscapes.env`
    const content = require('fs').readFileSync(globalSettingsFileName, 'utf-8');
    const secrets = content.split('\n').map(function(line) {
      return line.split('=')[1];
    }).filter( (x) => !!x);

    const  maskSecrets = function(x) {
      let result = x;
      const replaceAll = function(s, search, replacement) {
        var target = s;
        return target.split(search).join(replacement);
      };
      for (var secret of secrets) {
        const safeString = secret.substring(0, 2) + '***' + secret.substring(-2);
        result = replaceAll(result, secret, safeString);
      }
      return result;
    }
    for (var secret of secrets) {
      console.info(maskSecrets(`We have a secret: ${secret}`));
    }
    // if (!require('fs').existsSync(globalSettingsFileName)) {
      // console.info(`FATAL: ${globalSettingsFileName} does not exist.`);
      // process.exit(1);
    // }

    const bashFileContent = `
  . "${globalSettingsFileName}"
  . "${settingsFileName}" || true
  set -e
  . ~/.nvm/nvm.sh
  rm -rf /repo
  git clone https://$GITHUB_USER:$GITHUB_TOKEN@github.com/${landscape.repo} /repo
  cd /repo
  npm install && npm install interactive-landscape@latest && cp ./node_modules/interactive-landscape/.nvmrc . && nvm install \`cat .nvmrc\` && nvm use && npm install -g npm && npm install && npm install interactive-landscape@latest && (export PROJECT_PATH="$PWD"; npm explore interactive-landscape -- npm run update) && npm explore interactive-landscape -- npm run check-links && git add . && git config --global user.email "info@cncf.io" && git config --global user.name "CNCF-bot" && git commit -m "Automated update by CNCF-bot" && git push origin HEAD
  `;

    function runIt() {
      return new Promise(function(resolve) {
        var spawn = require('child_process').spawn;
        var child = spawn('bash', ['-lc', bashFileContent ]);
        child.stdout.on('data', function(data) {
          console.log(data.toString('utf-8'));
          //Here is where the output goes
        });
        child.stderr.on('data', function(data) {
          console.log(data.toString('utf-8'));
          //Here is where the error output goes
        });
        child.on('close', function(code) {
          resolve(code);
          //Here you can get the exit code of the script
        });
      });
    }

    const returnCode = await runIt();
    console.info(`${landscape.name} returned with a ${returnCode}`);


  }
}
main();

