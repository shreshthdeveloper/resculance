import { RefreshCw } from 'lucide-react';
import { Loader } from './Loader';

export const Table = ({ columns, data, onRowClick, onRefresh, isRefreshing, loading = false }) => {
  return (
    <div className="table-container">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-background border-b border-border">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  className="px-4 py-3 text-left text-sm font-semibold text-text"
                >
                  <div className="flex items-center justify-between">
                    <span>{column.header}</span>
                    {index === columns.length - 1 && onRefresh && (
                      <button
                        onClick={onRefresh}
                        className="flex items-center gap-2 px-2 py-1 rounded-md bg-background hover:bg-border text-sm shadow-sm transition-colors"
                        title="Refresh table"
                      >
                        <RefreshCw className={`w-4 h-4 text-text-secondary ${isRefreshing ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center">
                  <Loader inline message="Loading..." />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-text-secondary">
                  No data available
                </td>
              </tr>
            ) : (
              data.map((row, rowIndex) => (
                <tr
                  key={row.id ?? rowIndex}
                  onClick={() => onRowClick?.(row)}
                  className={`hover:bg-background transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {columns.map((column, colIndex) => (
                    <td key={column.accessor ?? colIndex} className="px-4 py-3 text-sm text-text">
                      {column.render ? column.render(row) : row[column.accessor]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
