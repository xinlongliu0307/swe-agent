export class ValidationError extends Error {
  problems: string[];
  constructor(problems: string[]) {
    super(problems.join("; "));
    this.problems = problems;
  }
}

export class NotFoundError extends Error {}
