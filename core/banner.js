const colors = {
    reset: '\x1b[0m',
    cyan: '\x1b[36m',
    blue: '\x1b[34m',
    green: '\x1b[32m',
    yellow: '\x1b[33m'
};

function getRandomColor() {
    const colorKeys = Object.keys(colors).filter(key => key !== 'reset');
    return colors[colorKeys[Math.floor(Math.random() * colorKeys.length)]];
}

function displayBanner() {
    const banner = `
    ____                   ___    ____  ____
   / __ \\____  ___  ____  /   |  / __ \\/  _/
  / / / / __ \\/ _ \\/ __ \\/ /| | / /_/ // /  
 / /_/ / /_/ /  __/ / / / ___ |/ ____// /   
 \\____/ .___/\\___/_/ /_/_/  |_/_/   /___/   
     /_/                                     
    `;
    console.log(getRandomColor() + banner + colors.reset);
    console.log(`${colors.cyan}OpenAPI based on Nodejs${colors.reset}`);
}
module.exports = { displayBanner };
