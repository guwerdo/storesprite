import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useAppTranslation } from '../../../i18n/I18nProvider.js';
import type { IMapping, IMappingSchedule } from '../../../types/stocksprite/Mapping.interface.js';
import type { IDataConnection } from '../../../types/stocksprite/DataConnection.interface.js';
import ConfirmDialog from '../../../components/ConfirmDialog.js';

type ScheduleFrequency = 'once' | 'daily' | 'monthly';

export interface ScheduleFormProps {
  initialMapping: IMapping | null;
  connections: IDataConnection[];
  mappings: IMapping[];
  onSave: (mappingId: string, payload: { scheduleEnabled: boolean; schedule: IMappingSchedule }) => Promise<void>;
  onDelete: (mappingId: string) => Promise<void>;
  onRun: (mappingId: string) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => i + 1);
const WEEKDAYS: { value: number; key: string }[] = [
  { value: 1, key: 'mon' },
  { value: 2, key: 'tue' },
  { value: 3, key: 'wed' },
  { value: 4, key: 'thu' },
  { value: 5, key: 'fri' },
  { value: 6, key: 'sat' },
  { value: 0, key: 'sun' },
];

const DEFAULT_SCHEDULE: IMappingSchedule = { frequency: 'daily', times: [9] };

const makeDefaultSchedule = (frequency: ScheduleFrequency): IMappingSchedule => {
  switch (frequency) {
    case 'once':
      return { frequency: 'once', date: '', time: 9 };
    case 'monthly':
      return { frequency: 'monthly', dayOfMonth: 1, time: 9 };
    case 'daily':
      return DEFAULT_SCHEDULE;
  }
};

const formatHour = (hour: number): string => `${String(hour).padStart(2, '0')}:00`;

interface HourSelectProps {
  value: number;
  onChange: (hour: number) => void;
  labelId?: string;
  label?: string;
}

function HourSelect({ value, onChange, labelId, label }: HourSelectProps): React.JSX.Element {
  return (
    <FormControl sx={{ minWidth: 140 }}>
      {label && <InputLabel id={labelId}>{label}</InputLabel>}
      <Select labelId={labelId} label={label} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {HOURS.map((h) => (
          <MenuItem key={h} value={h}>
            {formatHour(h)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export default function ScheduleForm({
  initialMapping,
  connections,
  mappings,
  onSave,
  onDelete,
  onRun,
  onCancel,
  saving = false,
}: ScheduleFormProps): React.JSX.Element {
  const { t } = useAppTranslation();

  const isEditing = !!initialMapping?.id;
  const initialSchedule = initialMapping?.schedule ?? null;

  const [connectionId, setConnectionId] = useState<string>(initialMapping?.connectionId ?? '');
  const [scheduleEnabled, setScheduleEnabled] = useState<boolean>(initialMapping?.scheduleEnabled ?? false);
  const [schedule, setSchedule] = useState<IMappingSchedule>(initialSchedule ?? DEFAULT_SCHEDULE);
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() =>
    JSON.stringify({ scheduleEnabled: initialMapping?.scheduleEnabled ?? false, schedule: initialSchedule ?? DEFAULT_SCHEDULE })
  );
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);

  const dirty = JSON.stringify({ scheduleEnabled, schedule }) !== savedSnapshot;

  const addableConnections = useMemo(() => {
    const mappingByConnectionId = new Map(mappings.map((m) => [m.connectionId, m]));
    return connections.filter((c) => {
      const mapping = mappingByConnectionId.get(c.id);
      return (
        c.testResult?.success === true &&
        (c.testResult.columns?.length ?? 0) > 0 &&
        !!mapping &&
        mapping.schedule == null
      );
    });
  }, [connections, mappings]);

  const mappingId = useMemo(() => {
    if (isEditing) {
      return initialMapping?.id ?? null;
    }
    return mappings.find((m) => m.connectionId === connectionId)?.id ?? null;
  }, [isEditing, initialMapping, mappings, connectionId]);

  const connectionName = isEditing
    ? connections.find((c) => c.id === initialMapping?.connectionId)?.name ?? initialMapping?.connectionId ?? ''
    : connections.find((c) => c.id === connectionId)?.name ?? '';

  const scheduleInvalid = scheduleEnabled && schedule.frequency === 'once' && !schedule.date;
  const canSave = !!mappingId && !scheduleInvalid && !saving;

  const handleSave = async (): Promise<void> => {
    if (!mappingId) return;
    try {
      await onSave(mappingId, { scheduleEnabled, schedule });
      setSavedSnapshot(JSON.stringify({ scheduleEnabled, schedule }));
    } catch {
      // parent shows the error toast
    }
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    setDeleteModalOpen(false);
    if (mappingId) {
      try {
        await onDelete(mappingId);
      } catch {
        // parent shows the error toast
      }
    }
  };

  const handleRun = async (): Promise<void> => {
    if (!mappingId) return;
    try {
      await onRun(mappingId);
    } catch {
      // parent shows the error toast
    }
  };

  const toggleDay = (day: number): void => {
    setSchedule((prev) => {
      if (prev.frequency !== 'daily') return prev;
      const current = prev.daysOfWeek ?? [];
      const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
      return { ...prev, daysOfWeek: next.length > 0 ? next : undefined };
    });
  };

  const applyWeekdays = (): void => {
    setSchedule((prev) => (prev.frequency === 'daily' ? { ...prev, daysOfWeek: [1, 2, 3, 4, 5] } : prev));
  };

  const addHour = (): void => {
    setSchedule((prev) => {
      if (prev.frequency !== 'daily') return prev;
      const last = prev.times[prev.times.length - 1] ?? 8;
      return { ...prev, times: [...prev.times, (last + 1) % 24] };
    });
  };

  const removeHour = (index: number): void => {
    setSchedule((prev) => {
      if (prev.frequency !== 'daily') return prev;
      return { ...prev, times: prev.times.length > 1 ? prev.times.filter((_, i) => i !== index) : prev.times };
    });
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onCancel} sx={{ textTransform: 'none' }}>
          {t('stocksprite.schedule.backToList')}
        </Button>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {isEditing ? t('stocksprite.schedule.editTitle') : t('stocksprite.schedule.addTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('stocksprite.schedule.subtitle')}
          </Typography>
        </Box>
      </Box>

      <Card variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          {isEditing ? (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                {t('stocksprite.schedule.connection')}
              </Typography>
              <Typography variant="body1">{connectionName}</Typography>
            </Box>
          ) : (
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="schedule-connection-label">{t('stocksprite.schedule.connection')}</InputLabel>
              <Select
                labelId="schedule-connection-label"
                label={t('stocksprite.schedule.connection')}
                value={connectionId}
                onChange={(e) => setConnectionId(e.target.value)}
              >
                {addableConnections.length === 0 && (
                  <MenuItem value="" disabled>
                    {t('stocksprite.schedule.noAvailableConnections')}
                  </MenuItem>
                )}
                {addableConnections.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {!!mappingId && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {t('stocksprite.schedule.enable')}
                </Typography>
                <Switch checked={scheduleEnabled} onChange={(e) => setScheduleEnabled(e.target.checked)} />
              </Box>

              <FormControl component="fieldset" fullWidth sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                  {t('stocksprite.schedule.frequency')}
                </Typography>
                <RadioGroup
                  row
                  value={schedule.frequency}
                  onChange={(e) => setSchedule(makeDefaultSchedule(e.target.value as ScheduleFrequency))}
                >
                  <FormControlLabel value="once" control={<Radio />} label={t('stocksprite.schedule.once')} />
                  <FormControlLabel value="daily" control={<Radio />} label={t('stocksprite.schedule.daily')} />
                  <FormControlLabel value="monthly" control={<Radio />} label={t('stocksprite.schedule.monthly')} />
                </RadioGroup>
              </FormControl>

              {schedule.frequency === 'once' && (
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  <TextField
                    label={t('stocksprite.schedule.date')}
                    type="date"
                    value={schedule.date}
                    onChange={(e) => setSchedule((prev) => (prev.frequency === 'once' ? { frequency: 'once', date: e.target.value, time: prev.time } : prev))}
                    InputLabelProps={{ shrink: true }}
                    sx={{ minWidth: 200 }}
                  />
                  <HourSelect
                    labelId="once-time-label"
                    label={t('stocksprite.schedule.time')}
                    value={schedule.time}
                    onChange={(h) => setSchedule((prev) => (prev.frequency === 'once' ? { frequency: 'once', date: prev.date, time: h } : prev))}
                  />
                </Box>
              )}

              {schedule.frequency === 'daily' && (
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                    {t('stocksprite.schedule.hours')}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', mb: 2 }}>
                    {schedule.times.map((hour, index) => (
                      <HourSelect
                        key={index}
                        value={hour}
                        onChange={(h) =>
                          setSchedule((prev) =>
                            prev.frequency === 'daily' ? { ...prev, times: prev.times.map((x, i) => (i === index ? h : x)) } : prev
                          )
                        }
                      />
                    ))}
                    <Button size="small" onClick={addHour} sx={{ textTransform: 'none' }}>
                      {t('stocksprite.schedule.addHour')}
                    </Button>
                    {schedule.times.length > 1 && (
                      <Button size="small" color="error" onClick={() => removeHour(schedule.times.length - 1)} sx={{ textTransform: 'none' }}>
                        {t('stocksprite.schedule.removeHour')}
                      </Button>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {t('stocksprite.schedule.daysOfWeek')}
                    </Typography>
                    <Button size="small" variant="outlined" onClick={applyWeekdays} sx={{ textTransform: 'none' }}>
                      {t('stocksprite.schedule.weekdays')}
                    </Button>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                    {WEEKDAYS.map((day) => (
                      <FormControlLabel
                        key={day.value}
                        control={
                          <Checkbox
                            size="small"
                            checked={(schedule.daysOfWeek ?? []).includes(day.value)}
                            onChange={() => toggleDay(day.value)}
                          />
                        }
                        label={t(`stocksprite.schedule.days.${day.key}`)}
                      />
                    ))}
                  </Box>
                  {(schedule.daysOfWeek ?? []).length === 0 && (
                    <FormHelperText>{t('stocksprite.schedule.daysOfWeekHelper')}</FormHelperText>
                  )}
                </Box>
              )}

              {schedule.frequency === 'monthly' && (
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  <FormControl sx={{ minWidth: 160 }}>
                    <InputLabel id="monthly-day-label">{t('stocksprite.schedule.dayOfMonth')}</InputLabel>
                    <Select
                      labelId="monthly-day-label"
                      label={t('stocksprite.schedule.dayOfMonth')}
                      value={schedule.dayOfMonth}
                      onChange={(e) =>
                        setSchedule((prev) => (prev.frequency === 'monthly' ? { ...prev, dayOfMonth: Number(e.target.value) } : prev))
                      }
                    >
                      {DAYS_OF_MONTH.map((d) => (
                        <MenuItem key={d} value={d}>
                          {d}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <HourSelect
                    labelId="monthly-time-label"
                    label={t('stocksprite.schedule.time')}
                    value={schedule.time}
                    onChange={(h) => setSchedule((prev) => (prev.frequency === 'monthly' ? { ...prev, time: h } : prev))}
                  />
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
        <Box>
          <Button
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteModalOpen(true)}
            disabled={!mappingId || saving}
            sx={{ textTransform: 'none' }}
          >
            {t('stocksprite.schedule.deleteSchedule')}
          </Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<PlayArrowIcon />}
            onClick={() => void handleRun()}
            disabled={dirty || !mappingId || saving}
            sx={{ textTransform: 'none' }}
          >
            {t('stocksprite.schedule.runNow')}
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            onClick={() => void handleSave()}
            disabled={!canSave}
            sx={{ textTransform: 'none', borderRadius: 2, px: 3 }}
          >
            {saving ? t('common.saving') : t('stocksprite.schedule.save')}
          </Button>
        </Box>
      </Box>

      <ConfirmDialog
        open={deleteModalOpen}
        title={t('stocksprite.schedule.deleteModal.title')}
        description={t('stocksprite.schedule.deleteModal.prompt')}
        confirmLabel={t('stocksprite.schedule.deleteModal.yes')}
        cancelLabel={t('stocksprite.schedule.deleteModal.no')}
        destructive
        onConfirm={() => void handleDeleteConfirm()}
        onClose={() => setDeleteModalOpen(false)}
      />
    </Box>
  );
}
