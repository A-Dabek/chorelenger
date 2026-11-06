@file:OptIn(ExperimentalMaterial3Api::class)

package dev.dombeg.chorelenger.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import dev.dombeg.chorelenger.data.RecurrenceMode
import dev.dombeg.chorelenger.data.RecurrenceUnit
import dev.dombeg.chorelenger.reminders.DEFAULT_REMINDER_HOURS
import dev.dombeg.chorelenger.reminders.HOUR_MILLIS
import dev.dombeg.chorelenger.reminders.MAX_REMINDER_HOURS
import dev.dombeg.chorelenger.reminders.MIN_REMINDER_HOURS
import dev.dombeg.chorelenger.reminders.RecurrenceSpec
import dev.dombeg.chorelenger.reminders.defaultFirstExecution
import dev.dombeg.chorelenger.reminders.formatReminderAt
import dev.dombeg.chorelenger.reminders.isValidFirstExecution
import dev.dombeg.chorelenger.reminders.isValidRecurrenceCount
import dev.dombeg.chorelenger.reminders.isValidReminderHours
import dev.dombeg.chorelenger.reminders.maxCount
import dev.dombeg.chorelenger.reminders.recurrenceLabel
import dev.dombeg.chorelenger.reminders.unitLabel
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

private val presetHours = listOf(1, 4, 24, 72)

private enum class ReminderStep { TYPE, ONE_TIME, PERIODIC_FIRST, PERIODIC_INTERVAL, PERIODIC_MODE }

private enum class ReminderType { ONE_TIME, PERIODIC }

/** Full-screen type-aware reminder wizard. */
@Composable
fun ReminderScreen(
    draft: ReminderDraft,
    nowMillis: Long,
    onConfirm: (ReminderSelection) -> Unit,
    onRemove: () -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val zone = remember { ZoneId.systemDefault() }

    var stepName by rememberSaveable(draft.noteId) { mutableStateOf(ReminderStep.TYPE.name) }
    val step = ReminderStep.valueOf(stepName)

    var selectedTypeName by rememberSaveable(draft.noteId) {
        mutableStateOf(
            when {
                draft.existingRecurrence != null -> ReminderType.PERIODIC.name
                draft.hasReminder -> ReminderType.ONE_TIME.name
                else -> ""
            },
        )
    }
    val selectedType = selectedTypeName.takeIf { it.isNotEmpty() }
        ?.let(ReminderType::valueOf)

    var hoursText by rememberSaveable(draft.noteId) {
        mutableStateOf(draft.initialHours.toString())
    }
    val hours = hoursText.toIntOrNull()
    val validHours = isValidReminderHours(hours)

    var firstAt by rememberSaveable(draft.noteId) {
        mutableStateOf(defaultFirstExecution(draft.existingReminderAt, nowMillis, zone))
    }
    var countText by rememberSaveable(draft.noteId) {
        mutableStateOf((draft.existingRecurrence?.count ?: 1).toString())
    }
    var unitName by rememberSaveable(draft.noteId) {
        mutableStateOf((draft.existingRecurrence?.unit ?: RecurrenceUnit.DAYS).name)
    }
    var modeName by rememberSaveable(draft.noteId) {
        mutableStateOf((draft.existingRecurrence?.mode ?: RecurrenceMode.ABSOLUTE).name)
    }
    val unit = RecurrenceUnit.valueOf(unitName)
    val mode = RecurrenceMode.valueOf(modeName)
    val count = countText.toIntOrNull()
    val validCount = isValidRecurrenceCount(unit, count)
    val validFirst = isValidFirstExecution(firstAt, nowMillis)

    var showDatePicker by rememberSaveable { mutableStateOf(false) }
    var showTimePicker by rememberSaveable { mutableStateOf(false) }

    fun stepFor(type: ReminderType): ReminderStep = when (type) {
        ReminderType.ONE_TIME -> ReminderStep.ONE_TIME
        ReminderType.PERIODIC -> ReminderStep.PERIODIC_FIRST
    }

    fun goBack() {
        stepName = when (step) {
            ReminderStep.TYPE -> {
                onCancel()
                return
            }
            ReminderStep.ONE_TIME -> ReminderStep.TYPE.name
            ReminderStep.PERIODIC_FIRST -> ReminderStep.TYPE.name
            ReminderStep.PERIODIC_INTERVAL -> ReminderStep.PERIODIC_FIRST.name
            ReminderStep.PERIODIC_MODE -> ReminderStep.PERIODIC_INTERVAL.name
        }
    }

    BackHandler(onBack = ::goBack)

    Scaffold(
        modifier = modifier
            .fillMaxSize()
            .testTag(TestTags.ReminderScreen),
        topBar = {
            TopAppBar(
                title = {
                    Text(if (draft.hasReminder) "Update reminder" else "Set reminder")
                },
                navigationIcon = {
                    IconButton(onClick = ::goBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                        )
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(text = draft.text, style = MaterialTheme.typography.titleMedium)

            when (step) {
                ReminderStep.TYPE -> {
                    Column(
                        modifier = Modifier.testTag(TestTags.ReminderTypeStep),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text(
                            text = "How often?",
                            style = MaterialTheme.typography.titleSmall,
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(
                                selected = selectedType == ReminderType.ONE_TIME,
                                onClick = {
                                    selectedTypeName = ReminderType.ONE_TIME.name
                                    if (!draft.hasReminder) {
                                        stepName = ReminderStep.ONE_TIME.name
                                    }
                                },
                                label = { Text("One-time") },
                                modifier = Modifier.testTag(TestTags.ReminderOneTimeOption),
                            )
                            FilterChip(
                                selected = selectedType == ReminderType.PERIODIC,
                                onClick = {
                                    selectedTypeName = ReminderType.PERIODIC.name
                                    if (!draft.hasReminder) {
                                        stepName = ReminderStep.PERIODIC_FIRST.name
                                    }
                                },
                                label = { Text("Periodic") },
                                modifier = Modifier.testTag(TestTags.ReminderPeriodicOption),
                            )
                        }
                        if (draft.hasReminder) {
                            Button(
                                onClick = {
                                    val type = selectedType ?: return@Button
                                    stepName = stepFor(type).name
                                },
                                enabled = selectedType != null,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .testTag(TestTags.ReminderNextButton),
                            ) {
                                Text("Next")
                            }
                        }
                    }

                    WizardCancelButton(onCancel = onCancel)
                }

                ReminderStep.ONE_TIME -> {
                    ReminderHoursEditor(
                        hoursText = hoursText,
                        onHoursChange = { hoursText = it },
                        hours = hours,
                        valid = validHours,
                        nowMillis = nowMillis,
                        zone = zone,
                    )

                    Button(
                        onClick = { hours?.let { onConfirm(ReminderSelection.OneTime(it)) } },
                        enabled = validHours,
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag(TestTags.ReminderConfirmButton),
                    ) {
                        Text(if (draft.hasReminder) "Update reminder" else "Set reminder")
                    }

                    if (draft.hasReminder) {
                        TextButton(
                            onClick = onRemove,
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag(TestTags.ReminderRemoveButton),
                        ) {
                            Text("Remove reminder")
                        }
                    }

                    WizardBackButton(onClick = ::goBack)
                    WizardCancelButton(onCancel = onCancel)
                }

                ReminderStep.PERIODIC_FIRST -> {
                    Column(
                        modifier = Modifier.testTag(TestTags.ReminderFirstStep),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text(
                            text = "First execution",
                            style = MaterialTheme.typography.titleSmall,
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(
                                onClick = { showDatePicker = true },
                                modifier = Modifier
                                    .weight(1f)
                                    .testTag(TestTags.ReminderDateButton),
                            ) {
                                Text(formatDate(firstAt, zone))
                            }
                            OutlinedButton(
                                onClick = { showTimePicker = true },
                                modifier = Modifier
                                    .weight(1f)
                                    .testTag(TestTags.ReminderTimeButton),
                            ) {
                                Text(formatTime(firstAt, zone))
                            }
                        }
                        if (validFirst) {
                            Text(
                                text = formatReminderAt(firstAt, zone),
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.tertiary,
                                modifier = Modifier.testTag(TestTags.ReminderDueLabel),
                            )
                        } else {
                            Text(
                                text = "Choose a time in the future",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.error,
                                modifier = Modifier.testTag(TestTags.ReminderDueLabel),
                            )
                        }
                        Button(
                            onClick = { stepName = ReminderStep.PERIODIC_INTERVAL.name },
                            enabled = validFirst,
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag(TestTags.ReminderNextButton),
                        ) {
                            Text("Next")
                        }
                    }

                    WizardBackButton(onClick = ::goBack)
                    WizardCancelButton(onCancel = onCancel)
                }

                ReminderStep.PERIODIC_INTERVAL -> {
                    Column(
                        modifier = Modifier.testTag(TestTags.ReminderIntervalStep),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text(
                            text = "Repeat every",
                            style = MaterialTheme.typography.titleSmall,
                        )
                        OutlinedTextField(
                            value = countText,
                            onValueChange = { countText = it },
                            label = { Text("Count") },
                            singleLine = true,
                            isError = !validCount,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag(TestTags.ReminderIntervalCountField),
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            UnitChip(
                                label = "Days",
                                selected = unit == RecurrenceUnit.DAYS,
                                tag = TestTags.ReminderUnitDays,
                                onClick = { unitName = RecurrenceUnit.DAYS.name },
                            )
                            UnitChip(
                                label = "Weeks",
                                selected = unit == RecurrenceUnit.WEEKS,
                                tag = TestTags.ReminderUnitWeeks,
                                onClick = { unitName = RecurrenceUnit.WEEKS.name },
                            )
                            UnitChip(
                                label = "Months",
                                selected = unit == RecurrenceUnit.MONTHS,
                                tag = TestTags.ReminderUnitMonths,
                                onClick = { unitName = RecurrenceUnit.MONTHS.name },
                            )
                        }
                        if (validCount) {
                            Text(
                                text = "Every ${count ?: 1} ${unitLabel(unit, count ?: 1)}",
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.tertiary,
                            )
                        } else {
                            Text(
                                text = "Enter a count between 1 and ${unit.maxCount}",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.error,
                            )
                        }
                        Button(
                            onClick = { stepName = ReminderStep.PERIODIC_MODE.name },
                            enabled = validCount,
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag(TestTags.ReminderNextButton),
                        ) {
                            Text("Next")
                        }
                    }

                    WizardBackButton(onClick = ::goBack)
                    WizardCancelButton(onCancel = onCancel)
                }

                ReminderStep.PERIODIC_MODE -> {
                    Column(
                        modifier = Modifier.testTag(TestTags.ReminderModeStep),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Text(
                            text = "How should the next date be counted?",
                            style = MaterialTheme.typography.titleSmall,
                        )
                        ModeOption(
                            title = "Absolute",
                            description = "Count from the previous due time. " +
                                "Every 1 week: first Sunday \u2192 every Sunday.",
                            selected = mode == RecurrenceMode.ABSOLUTE,
                            tag = TestTags.ReminderModeAbsolute,
                            onClick = { modeName = RecurrenceMode.ABSOLUTE.name },
                        )
                        ModeOption(
                            title = "Relative",
                            description = "Count from when you tap Done. " +
                                "2 months after done.",
                            selected = mode == RecurrenceMode.RELATIVE,
                            tag = TestTags.ReminderModeRelative,
                            onClick = { modeName = RecurrenceMode.RELATIVE.name },
                        )

                        val summary = recurrenceLabel(
                            RecurrenceSpec(unit, count ?: 1, mode),
                        )
                        Text(
                            text = "${formatReminderAt(firstAt, zone)} \u00B7 $summary",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.tertiary,
                            modifier = Modifier.testTag(TestTags.ReminderSummary),
                        )

                        Button(
                            onClick = {
                                val value = count ?: return@Button
                                if (!validFirst || !validCount) return@Button
                                onConfirm(
                                    ReminderSelection.Periodic(
                                        firstAt = firstAt,
                                        unit = unit,
                                        count = value,
                                        mode = mode,
                                    ),
                                )
                            },
                            enabled = validFirst && validCount,
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag(TestTags.ReminderConfirmButton),
                        ) {
                            Text(if (draft.hasReminder) "Update reminder" else "Set reminder")
                        }

                        if (draft.isPeriodic) {
                            TextButton(
                                onClick = onRemove,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .testTag(TestTags.ReminderRemoveButton),
                            ) {
                                Text("Remove repeat")
                            }
                        }
                    }

                    WizardBackButton(onClick = ::goBack)
                    WizardCancelButton(onCancel = onCancel)
                }
            }
        }
    }

    if (showDatePicker) {
        val datePickerState = rememberDatePickerState(
            initialSelectedDateMillis = localDateAsUtcMillis(firstAt, zone),
        )
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        datePickerState.selectedDateMillis?.let { millis ->
                            val date = Instant.ofEpochMilli(millis)
                                .atZone(ZoneOffset.UTC)
                                .toLocalDate()
                            val time = Instant.ofEpochMilli(firstAt).atZone(zone).toLocalTime()
                            firstAt = date.atTime(time).atZone(zone).toInstant().toEpochMilli()
                        }
                        showDatePicker = false
                    },
                ) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text("Cancel") }
            },
        ) {
            DatePicker(state = datePickerState)
        }
    }

    if (showTimePicker) {
        val local = Instant.ofEpochMilli(firstAt).atZone(zone)
        val timePickerState = rememberTimePickerState(
            initialHour = local.hour,
            initialMinute = local.minute,
            is24Hour = true,
        )
        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        val date = Instant.ofEpochMilli(firstAt).atZone(zone).toLocalDate()
                        firstAt = date
                            .atTime(timePickerState.hour, timePickerState.minute)
                            .atZone(zone)
                            .toInstant()
                            .toEpochMilli()
                        showTimePicker = false
                    },
                ) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showTimePicker = false }) { Text("Cancel") }
            },
            text = { TimePicker(state = timePickerState) },
        )
    }
}

@Composable
private fun ReminderHoursEditor(
    hoursText: String,
    onHoursChange: (String) -> Unit,
    hours: Int?,
    valid: Boolean,
    nowMillis: Long,
    zone: ZoneId,
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        OutlinedButton(
            onClick = {
                val value = hoursText.toIntOrNull() ?: DEFAULT_REMINDER_HOURS
                onHoursChange(
                    (value - 1).coerceIn(MIN_REMINDER_HOURS, MAX_REMINDER_HOURS).toString(),
                )
            },
        ) { Text("\u2212") }
        OutlinedTextField(
            value = hoursText,
            onValueChange = onHoursChange,
            label = { Text("Hours from now") },
            singleLine = true,
            isError = !valid,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier
                .weight(1f)
                .testTag(TestTags.ReminderHoursField),
        )
        OutlinedButton(
            onClick = {
                val value = hoursText.toIntOrNull() ?: DEFAULT_REMINDER_HOURS
                onHoursChange(
                    (value + 1).coerceIn(MIN_REMINDER_HOURS, MAX_REMINDER_HOURS).toString(),
                )
            },
        ) { Text("+") }
    }

    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        presetHours.forEach { preset ->
            FilterChip(
                selected = hours == preset,
                onClick = { onHoursChange(preset.toString()) },
                label = { Text("$preset h") },
            )
        }
    }

    if (valid) {
        Text(
            text = formatReminderAt(nowMillis + hours!! * HOUR_MILLIS, zone),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.tertiary,
            modifier = Modifier.testTag(TestTags.ReminderDueLabel),
        )
    } else {
        Text(
            text = "Enter whole hours between $MIN_REMINDER_HOURS and $MAX_REMINDER_HOURS",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.testTag(TestTags.ReminderDueLabel),
        )
    }
}

@Composable
private fun UnitChip(
    label: String,
    selected: Boolean,
    tag: String,
    onClick: () -> Unit,
) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = { Text(label) },
        modifier = Modifier.testTag(tag),
    )
}

@Composable
private fun ModeOption(
    title: String,
    description: String,
    selected: Boolean,
    tag: String,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .testTag(tag),
        verticalAlignment = Alignment.Top,
    ) {
        RadioButton(selected = selected, onClick = onClick)
        Column(modifier = Modifier.padding(top = 12.dp)) {
            Text(text = title, style = MaterialTheme.typography.titleSmall)
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun WizardBackButton(onClick: () -> Unit) {
    TextButton(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .testTag(TestTags.ReminderBackButton),
    ) {
        Text("Back")
    }
}

@Composable
private fun WizardCancelButton(onCancel: () -> Unit) {
    TextButton(
        onClick = onCancel,
        modifier = Modifier
            .fillMaxWidth()
            .testTag(TestTags.ReminderCancelButton),
    ) {
        Text("Cancel")
    }
}

private fun localDateAsUtcMillis(epochMillis: Long, zone: ZoneId): Long {
    val date = Instant.ofEpochMilli(epochMillis).atZone(zone).toLocalDate()
    return date.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
}

private val dateButtonFormatter = DateTimeFormatter.ofPattern("EEE, MMM d", Locale.US)
private val timeButtonFormatter = DateTimeFormatter.ofPattern("HH:mm", Locale.US)

private fun formatDate(epochMillis: Long, zone: ZoneId): String =
    dateButtonFormatter.withZone(zone).format(Instant.ofEpochMilli(epochMillis))

private fun formatTime(epochMillis: Long, zone: ZoneId): String =
    timeButtonFormatter.withZone(zone).format(Instant.ofEpochMilli(epochMillis))
