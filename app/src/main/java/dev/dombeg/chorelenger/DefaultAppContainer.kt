package dev.dombeg.chorelenger

import android.content.Context
import dev.dombeg.chorelenger.data.AppDatabase
import dev.dombeg.chorelenger.data.NoteDao
import dev.dombeg.chorelenger.speech.NativeTranscriptionService
import dev.dombeg.chorelenger.speech.TranscriptionService

/** Production container: real Room database + system speech recognizer. */
class DefaultAppContainer(private val context: Context) : AppContainer {

    private val database by lazy { AppDatabase.get(context) }
    private val transcription by lazy { NativeTranscriptionService(context) }

    override fun noteDao(): NoteDao = database.noteDao()

    override fun transcriptionService(): TranscriptionService = transcription
}
