package dev.dombeg.chorelenger.ui

import androidx.activity.compose.BackHandler
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
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import dev.dombeg.chorelenger.reminders.DEFAULT_REMINDER_HOURS
import dev.dombeg.chorelenger.reminders.HOUR_MILLIS
import dev.dombeg.chorelenger.reminders.MAX_REMINDER_HOURS
import dev.dombeg.chorelenger.reminders.MIN_REMINDER_HOURS
import dev.dombeg.chorelenger.reminders.formatReminderAt
import dev.dombeg.chorelenger.reminders.isValidReminderHours

private val presetHours = listOf(1, 4, 24, 72)

/** Full-screen one-time reminder editor. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReminderScreen(
    draft: ReminderDraft,
    nowMillis: Long,
    onConfirm: (Int) -> Unit,
    onRemove: () -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    BackHandler(onBack = onCancel)

    var hoursText by rememberSaveable(draft.noteId) {
        mutableStateOf(draft.initialHours.toString())
    }
    val hours = hoursText.toIntOrNull()
    val valid = isValidReminderHours(hours)

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
                    IconButton(onClick = onCancel) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Cancel",
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
            Text(
                text = draft.text,
                style = MaterialTheme.typography.titleMedium,
            )

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                OutlinedButton(
                    onClick = {
                        val value = hoursText.toIntOrNull() ?: DEFAULT_REMINDER_HOURS
                        hoursText = (value - 1).coerceIn(MIN_REMINDER_HOURS, MAX_REMINDER_HOURS)
                            .toString()
                    },
                ) { Text("\u2212") }
                OutlinedTextField(
                    value = hoursText,
                    onValueChange = { hoursText = it },
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
                        hoursText = (value + 1).coerceIn(MIN_REMINDER_HOURS, MAX_REMINDER_HOURS)
                            .toString()
                    },
                ) { Text("+") }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                presetHours.forEach { preset ->
                    FilterChip(
                        selected = hours == preset,
                        onClick = { hoursText = preset.toString() },
                        label = { Text("$preset h") },
                    )
                }
            }

            if (valid) {
                Text(
                    text = formatReminderAt(nowMillis + hours!! * HOUR_MILLIS),
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

            Button(
                onClick = { hours?.let(onConfirm) },
                enabled = valid,
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

            TextButton(
                onClick = onCancel,
                modifier = Modifier
                    .fillMaxWidth()
                    .testTag(TestTags.ReminderCancelButton),
            ) {
                Text("Cancel")
            }
        }
    }
}
