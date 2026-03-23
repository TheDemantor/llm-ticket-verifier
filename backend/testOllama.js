import { validateSolutionAgainstOld } from './ollamaClient.js';

const run = async () => {
  const newSolution = "Restarted PostgreSQL and increased max_connections.";
  const oldSolutions = [
    "Restarted PostgreSQL service and tuned max_connections to 500.",
    "Migrated DB to a different host."
  ];

  const result = await validateSolutionAgainstOld(newSolution, oldSolutions);
  // console.log(result);
};

run().catch(console.error);
