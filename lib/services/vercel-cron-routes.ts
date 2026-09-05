import ts from 'typescript';

function hasExportModifier(node: ts.Node): boolean {
  return ts.canHaveModifiers(node)
    ? (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    : false;
}

/**
 * Whether a route module exports a handler named GET. Vercel Cron only ever
 * sends GET, so a cron route without this export answers 405 and never runs.
 *
 * @param source - TypeScript source of the route module.
 * @returns True when GET is an exported function, const or re-export name.
 */
export function exportsGetHandler(source: string): boolean {
  const file = ts.createSourceFile('route.ts', source, ts.ScriptTarget.Latest, true);

  return file.statements.some((statement) => {
    if (ts.isFunctionDeclaration(statement)) {
      return hasExportModifier(statement) && statement.name?.text === 'GET';
    }
    if (ts.isVariableStatement(statement)) {
      return (
        hasExportModifier(statement) &&
        statement.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === 'GET')
      );
    }
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      return statement.exportClause.elements.some((el) => el.name.text === 'GET');
    }
    return false;
  });
}
