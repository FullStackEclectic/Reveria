package handler

import (
	"encoding/binary"
	"testing"
)

func TestExtractLargestJPEGPrefersEmbeddedPreview(t *testing.T) {
	tiny := []byte{0xff, 0xd8, 0x00, 0x01, 0xff, 0xd9}
	payload := bytesRepeat(0x7f, 24000)
	large := append([]byte{0xff, 0xd8}, append(payload, 0xff, 0xd9)...)
	mixed := append(tiny, append(make([]byte, 8), large...)...)
	extracted := extractLargestJPEG(mixed)
	if len(extracted) != len(large) {
		t.Fatalf("extracted %d bytes, want %d", len(extracted), len(large))
	}
	if extracted[0] != 0xff || extracted[1] != 0xd8 {
		t.Fatal("extracted payload is not JPEG")
	}
}

func TestIsRawFilename(t *testing.T) {
	if !isRawFilename("IMG_0001.CR2") || isRawFilename("photo.jpg") {
		t.Fatal("RAW 扩展名识别不正确")
	}
}

func TestExtractLargestJPEGFromTiffPreviewTag(t *testing.T) {
	payload := bytesRepeat(0x7f, 24000)
	jpeg := append([]byte{0xff, 0xd8}, append(payload, 0xff, 0xd9)...)
	header := make([]byte, 8+2+24+4)
	copy(header[0:4], []byte("II*\x00"))
	binary.LittleEndian.PutUint32(header[4:8], 8)
	binary.LittleEndian.PutUint16(header[8:10], 2)
	// JPEGInterchangeFormat
	binary.LittleEndian.PutUint16(header[10:12], 513)
	binary.LittleEndian.PutUint16(header[12:14], 4)
	binary.LittleEndian.PutUint32(header[14:18], 1)
	binary.LittleEndian.PutUint32(header[18:22], uint32(len(header)))
	// JPEGInterchangeFormatLength
	binary.LittleEndian.PutUint16(header[22:24], 514)
	binary.LittleEndian.PutUint16(header[24:26], 4)
	binary.LittleEndian.PutUint32(header[26:30], 1)
	binary.LittleEndian.PutUint32(header[30:34], uint32(len(jpeg)))
	mixed := append(header, jpeg...)
	extracted := extractLargestJPEG(mixed)
	if len(extracted) != len(jpeg) {
		t.Fatalf("extracted %d bytes, want %d", len(extracted), len(jpeg))
	}
}

func TestExtractLargestJPEGFromCR3PreviewBox(t *testing.T) {
	payload := bytesRepeat(0x7f, 24000)
	jpeg := append([]byte{0xff, 0xd8}, append(payload, 0xff, 0xd9)...)
	prvw := make([]byte, 8+len(jpeg))
	binary.BigEndian.PutUint32(prvw[0:4], uint32(len(prvw)))
	copy(prvw[4:8], []byte("PRVW"))
	copy(prvw[8:], jpeg)
	ftyp := make([]byte, 16)
	binary.BigEndian.PutUint32(ftyp[0:4], 16)
	copy(ftyp[4:8], []byte("ftyp"))
	copy(ftyp[8:12], []byte("crx "))
	mixed := append(ftyp, prvw...)
	extracted := extractLargestJPEG(mixed)
	if len(extracted) != len(jpeg) {
		t.Fatalf("extracted %d bytes, want %d", len(extracted), len(jpeg))
	}
}

func bytesRepeat(value byte, count int) []byte {
	data := make([]byte, count)
	for index := range data {
		data[index] = value
	}
	return data
}
