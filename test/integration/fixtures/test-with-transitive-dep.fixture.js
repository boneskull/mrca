const dependency = require('./transitive-dep.fixture');

it('checks dependency', () => {
  if (dependency.testShouldFail === true) {
    throw new Error('test failed');
  }
});
