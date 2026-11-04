package dev.dombeg.chorelenger

import android.content.Context
import androidx.room.Room
import dev.dombeg.chorelenger.data.AppDatabase
import dev.dombeg.chorelenger.data.NoteDao
import dev.dombeg.chorelenger.speech.FakeTranscriptionService
import dev.dombeg.chorelenger.speech.TranscriptionService

/** Instrumented container: in-memory Room + fake speech. */
class TestAppContainer(context: Context) : AppContainer {
    val db: AppDatabase = Room.inMemoryDatabaseBuilder(
        context.applicationContext,
        AppDatabase::class.java,
    ).allowMainThreadQueries().build()

    val fakeTranscription = FakeTranscriptionService()

    override fun noteDao(): NoteDao = db.noteDao()

    override fun transcriptionService(): TranscriptionService = fakeTranscription

    override fun isAudioPermissionGranted(): Boolean = true
}
