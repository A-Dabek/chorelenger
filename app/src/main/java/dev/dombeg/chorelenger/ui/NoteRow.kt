package dev.dombeg.chorelenger.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import dev.dombeg.chorelenger.data.Note
import dev.dombeg.chorelenger.data.isReminder
import dev.dombeg.chorelenger.reminders.formatReminderDue
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val timestampFormatter: DateTimeFormatter =
    DateTimeFormatter.ofPattern("MMM d, HH:mm").withZone(ZoneId.systemDefault())

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NoteRow(
    note: Note,
    now: Long,
    onDelete: () -> Unit,
    onEditReminder: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val currentOnEdit by rememberUpdatedState(onEditReminder)
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { value ->
            if (value == SwipeToDismissBoxValue.StartToEnd) {
                currentOnEdit()
            }
            // Never dismiss the row; the gesture only opens the editor.
            false
        },
    )

    SwipeToDismissBox(
        state = dismissState,
        enableDismissFromStartToEnd = true,
        enableDismissFromEndToStart = false,
        modifier = modifier
            .fillMaxWidth()
            .testTag(TestTags.NoteRow),
        backgroundContent = {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.tertiaryContainer)
                    .padding(horizontal = 16.dp),
                contentAlignment = Alignment.CenterStart,
            ) {
                Text(
                    text = if (note.isReminder) "Change" else "Remind",
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onTertiaryContainer,
                )
            }
        },
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surface)
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = note.text, style = MaterialTheme.typography.bodyLarge)
                val reminderAt = note.reminderAt
                if (reminderAt != null) {
                    Text(
                        text = formatReminderDue(reminderAt, now),
                        style = MaterialTheme.typography.labelSmall,
                        color = if (reminderAt <= now) {
                            MaterialTheme.colorScheme.error
                        } else {
                            MaterialTheme.colorScheme.tertiary
                        },
                        modifier = Modifier.testTag(TestTags.ReminderBadge),
                    )
                } else {
                    Text(
                        text = formatTimestamp(note.createdAt),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            IconButton(
                onClick = onDelete,
                modifier = Modifier.testTag(TestTags.DeleteButton),
            ) {
                Icon(Icons.Filled.Delete, contentDescription = "Delete note")
            }
        }
    }
}

internal fun formatTimestamp(epochMillis: Long): String =
    timestampFormatter.format(Instant.ofEpochMilli(epochMillis))
