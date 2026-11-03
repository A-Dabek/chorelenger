package dev.dombeg.chorelenger.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import dev.dombeg.chorelenger.data.Note
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val timestampFormatter: DateTimeFormatter =
    DateTimeFormatter.ofPattern("MMM d, HH:mm").withZone(ZoneId.systemDefault())

@Composable
fun NoteRow(
    note: Note,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .testTag(TestTags.NoteRow)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(text = note.text, style = MaterialTheme.typography.bodyLarge)
            Text(
                text = formatTimestamp(note.createdAt),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        IconButton(
            onClick = onDelete,
            modifier = Modifier.testTag(TestTags.DeleteButton),
        ) {
            Icon(Icons.Filled.Delete, contentDescription = "Delete note")
        }
    }
}

internal fun formatTimestamp(epochMillis: Long): String =
    timestampFormatter.format(Instant.ofEpochMilli(epochMillis))
