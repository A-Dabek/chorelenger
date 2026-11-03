package dev.dombeg.chorelenger.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SanitizeNoteTextTest {

    @Test
    fun trimsSurroundingWhitespace() {
        assertEquals("walk the dog", sanitizeNoteText("  walk the dog\n"))
    }

    @Test
    fun rejectsBlank() {
        assertNull(sanitizeNoteText("   "))
        assertNull(sanitizeNoteText(""))
        assertNull(sanitizeNoteText("\n\t"))
    }

    @Test
    fun keepsInnerWhitespace() {
        assertEquals("a b", sanitizeNoteText(" a b "))
    }
}
