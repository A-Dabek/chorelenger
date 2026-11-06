package dev.dombeg.chorelenger.ui

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.dombeg.chorelenger.speech.VoiceState

@Composable
fun HomeScreen(
    viewModel: NotesViewModel,
    initialPermissionGranted: Boolean,
    initialNotificationPermissionGranted: Boolean = true,
    modifier: Modifier = Modifier,
) {
    val notes by viewModel.notes.collectAsStateWithLifecycle()
    val voiceState by viewModel.voiceState.collectAsStateWithLifecycle()
    val reminderDraft by viewModel.reminderDraft.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    var hasPermission by remember { mutableStateOf(initialPermissionGranted) }
    var permissionDenied by remember { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        hasPermission = granted
        permissionDenied = !granted
        if (granted) viewModel.onRecordButtonTap()
    }

    var notificationPermissionGranted by remember {
        mutableStateOf(initialNotificationPermissionGranted)
    }
    var pendingReminderHours by remember { mutableStateOf<Int?>(null) }
    var notificationsOff by remember { mutableStateOf(false) }

    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        notificationPermissionGranted = granted
        val hours = pendingReminderHours
        pendingReminderHours = null
        if (hours != null) {
            // Save regardless of the permission result.
            viewModel.onConfirmReminder(hours)
            notificationsOff = !granted
        }
    }

    val draft = reminderDraft
    if (draft != null) {
        ReminderScreen(
            draft = draft,
            nowMillis = viewModel.currentTimeMillis(),
            onConfirm = { hours ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                    !notificationPermissionGranted
                ) {
                    pendingReminderHours = hours
                    notificationPermissionLauncher.launch(
                        Manifest.permission.POST_NOTIFICATIONS,
                    )
                } else {
                    viewModel.onConfirmReminder(hours)
                }
            },
            onRemove = { viewModel.onRemoveReminder(draft.noteId) },
            onCancel = viewModel::onDismissReminderEditor,
            modifier = modifier,
        )
        return
    }

    LaunchedEffect(voiceState) {
        val state = voiceState
        if (state is VoiceState.Error) {
            val result = snackbarHostState.showSnackbar(
                message = state.message,
                actionLabel = "Retry",
            )
            if (result == SnackbarResult.ActionPerformed) {
                viewModel.onRecordButtonTap()
            }
        }
    }

    LaunchedEffect(permissionDenied) {
        if (permissionDenied) {
            snackbarHostState.showSnackbar("Microphone permission is required")
        }
    }

    LaunchedEffect(notificationsOff) {
        if (notificationsOff) {
            snackbarHostState.showSnackbar("Reminder saved — notifications are off")
            notificationsOff = false
        }
    }

    val listening = voiceState is VoiceState.Listening

    Scaffold(
        modifier = modifier.fillMaxSize(),
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            RecordButton(
                listening = listening,
                enabled = viewModel.isRecognizerAvailable,
                onClick = {
                    when {
                        !viewModel.isRecognizerAvailable -> Unit
                        hasPermission -> viewModel.onRecordButtonTap()
                        else -> permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                    }
                },
            )

            if (!viewModel.isRecognizerAvailable) {
                Text(
                    text = "Speech recognition isn't available on this device",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .padding(horizontal = 24.dp)
                        .testTag(TestTags.UnavailableNotice),
                )
            }

            if (listening) {
                val partial = (voiceState as VoiceState.Listening).partial
                Text(
                    text = if (partial.isBlank()) "Listening…" else partial,
                    style = MaterialTheme.typography.titleMedium,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp, vertical = 12.dp)
                        .testTag(TestTags.PartialText),
                )
            }

            if (notes.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    contentAlignment = Alignment.TopCenter,
                ) {
                    Text(
                        text = "No notes yet. Tap the button and say something.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.testTag(TestTags.EmptyState),
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(top = 12.dp),
                ) {
                    items(items = notes, key = { it.id }) { note ->
                        NoteRow(
                            note = note,
                            now = viewModel.currentTimeMillis(),
                            onDelete = { viewModel.delete(note.id) },
                            onEditReminder = { viewModel.onEditReminder(note) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun RecordButton(
    listening: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    val transition = rememberInfiniteTransition(label = "pulse")
    val pulseAlpha by transition.animateFloat(
        initialValue = 0.55f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 700),
            repeatMode = RepeatMode.Reverse,
        ),
        label = "pulseAlpha",
    )

    val container = when {
        listening -> MaterialTheme.colorScheme.tertiary
        else -> MaterialTheme.colorScheme.primary
    }
    val content = if (listening) MaterialTheme.colorScheme.onTertiary else MaterialTheme.colorScheme.onPrimary

    Box(
        modifier = Modifier
            .padding(vertical = 32.dp)
            .size(200.dp)
            .alpha(if (listening) pulseAlpha else if (enabled) 1f else 0.4f)
            .clip(CircleShape)
            .background(container)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .testTag(TestTags.RecordButton),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Icon(
                imageVector = if (listening) Icons.Filled.Stop else Icons.Filled.Mic,
                contentDescription = if (listening) "Stop recording" else "Start recording",
                tint = content,
                modifier = Modifier.size(64.dp),
            )
            Text(
                text = when {
                    listening -> "Listening… tap to stop"
                    enabled -> "Tap to speak"
                    else -> "Unavailable"
                },
                color = content,
                style = MaterialTheme.typography.titleMedium,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 8.dp, start = 12.dp, end = 12.dp),
            )
        }
    }
}
