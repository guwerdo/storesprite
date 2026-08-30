import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

export interface EntityListColumn<T> {
  header: string;
  render: (item: T) => React.ReactNode;
}

export interface EntityListProps<T> {
  title: string;
  subtitle: string;
  addLabel: string;
  emptyLabel: string;
  icon: React.ReactElement;
  nameHeader: string;
  items: T[];
  onAdd: () => void;
  onSelect: (item: T) => void;
  getKey: (item: T) => string;
  getName: (item: T) => string;
  extraColumns?: EntityListColumn<T>[];
}

export default function EntityList<T>({
  title,
  subtitle,
  addLabel,
  emptyLabel,
  icon,
  nameHeader,
  items,
  onAdd,
  onSelect,
  getKey,
  getName,
  extraColumns = [],
}: EntityListProps<T>): React.JSX.Element {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            {icon}
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={onAdd}
          sx={{ textTransform: 'none', fontWeight: 600, px: 3, py: 1, borderRadius: 2 }}
        >
          {addLabel}
        </Button>
      </Box>

      {items.length === 0 ? (
        <Card variant="outlined" sx={{ borderRadius: 2, textAlign: 'center', py: 6, bgcolor: 'background.paper' }}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            {React.cloneElement(icon, { sx: { fontSize: 48, color: 'text.disabled' } })}
            <Typography variant="h6" color="text.secondary">
              {emptyLabel}
            </Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={onAdd} sx={{ textTransform: 'none', mt: 1 }}>
              {addLabel}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 600 }}>{nameHeader}</TableCell>
                {extraColumns.map((c, i) => (
                  <TableCell key={i} sx={{ fontWeight: 600 }}>
                    {c.header}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={getKey(item)}
                  hover
                  onClick={() => onSelect(item)}
                  sx={{ cursor: 'pointer', '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {getName(item)}
                    </Typography>
                  </TableCell>
                  {extraColumns.map((c, i) => (
                    <TableCell key={i}>{c.render(item)}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
