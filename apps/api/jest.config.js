module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".spec.ts$",
  transform: {
    // .ts only: our own source is all TS. Matching .js too made ts-jest
    // try (and warn) to compile @secondhand/types' compiled dist/*.js.
    "^.+\\.ts$": "ts-jest",
  },
  collectCoverageFrom: ["**/*.(t|j)s"],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
};
