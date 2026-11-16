// Hostinger loads its entry file with require(). Import the ESM app explicitly.
import('./index.js')
  .then(({ runServer }) => runServer())
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
