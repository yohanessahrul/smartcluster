declare module "pg" {
  export interface QueryResultRow {
    [column: string]: unknown;
  }

  export interface QueryResult<R extends QueryResultRow = QueryResultRow> {
    rows: R[];
    rowCount: number;
  }

  export interface PoolClient {
    query<R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<R>>;
    release(): void;
  }

  export class Pool {
    constructor(config?: unknown);
    query<R extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<R>>;
    connect(): Promise<PoolClient>;
  }

  export const types: {
    setTypeParser: (oid: number, parser: (value: string) => unknown) => void;
  };
}
