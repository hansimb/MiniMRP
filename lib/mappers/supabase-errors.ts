export function isMissingTableError(message: string, tableName: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes(`could not find the table 'public.${tableName.toLowerCase()}'`) ||
    normalized.includes(`could not find the table 'private.${tableName.toLowerCase()}'`)
  );
}

export function isMissingColumnError(message: string, tableName: string, columnName: string) {
  const normalized = message.toLowerCase();
  const normalizedTableName = tableName.toLowerCase();
  const normalizedColumnName = columnName.toLowerCase();

  return (
    normalized.includes(`table ${normalizedTableName} has no column named ${normalizedColumnName}`) ||
    normalized.includes(`column ${normalizedTableName}.${normalizedColumnName} does not exist`) ||
    normalized.includes(`column "${normalizedColumnName}" does not exist`) ||
    normalized.includes(`could not find the '${normalizedColumnName}' column of '${normalizedTableName}'`)
  );
}

export function getSchemaSetupErrorMessage(message: string, tableName: string) {
  if (isMissingTableError(message, tableName)) {
    return `Database schema is missing "${tableName}". Run the SQL files in supabase/production/ in Supabase SQL Editor, then try again.`;
  }

  return message;
}

export function getColumnSetupErrorMessage(message: string, tableName: string, columnName: string) {
  if (isMissingColumnError(message, tableName, columnName)) {
    return `Database schema is missing "${tableName}.${columnName}". Run the SQL files in supabase/production/ in Supabase SQL Editor, then try again.`;
  }

  return message;
}
