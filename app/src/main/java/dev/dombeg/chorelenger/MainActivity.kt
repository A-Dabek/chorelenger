package dev.dombeg.chorelenger

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.dombeg.chorelenger.ui.HomeScreen
import dev.dombeg.chorelenger.ui.NotesViewModel
import dev.dombeg.chorelenger.ui.theme.ChorelengerTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val container = (application as ChorelengerApp).container
        val permissionGranted = container.isAudioPermissionGranted()
        setContent {
            ChorelengerTheme {
                val viewModel: NotesViewModel = viewModel {
                    NotesViewModel(container.noteDao(), container.transcriptionService())
                }
                HomeScreen(
                    viewModel = viewModel,
                    initialPermissionGranted = permissionGranted,
                )
            }
        }
    }
}
