package handler

import (
	"bytes"
	"encoding/binary"
	"path/filepath"
	"strings"
)

var rawExtensions = map[string]struct{}{
	".arw": {}, ".cr2": {}, ".cr3": {}, ".nef": {}, ".dng": {},
	".raf": {}, ".orf": {}, ".rw2": {}, ".pef": {}, ".srw": {}, ".raw": {},
}

func isRawFilename(name string) bool {
	_, ok := rawExtensions[strings.ToLower(filepath.Ext(name))]
	return ok
}

func extractLargestJPEG(data []byte) []byte {
	var best []byte
	consider := func(candidate []byte) {
		if len(candidate) > 20_000 && len(candidate) > len(best) && bytes.HasPrefix(candidate, []byte{0xff, 0xd8}) {
			best = candidate
		}
	}
	for _, candidate := range collectTiffJPEGs(data) {
		consider(candidate)
	}
	for _, candidate := range collectBoxJPEGs(data) {
		consider(candidate)
	}
	consider(scanLargestJPEG(data))
	return best
}

func scanLargestJPEG(data []byte) []byte {
	bestStart, bestEnd := -1, -1
	for index := 0; index < len(data)-1; index++ {
		if data[index] != 0xff || data[index+1] != 0xd8 {
			continue
		}
		for end := index + 2; end < len(data)-1; end++ {
			if data[end] != 0xff || data[end+1] != 0xd9 {
				continue
			}
			size := end + 2 - index
			if size > 20_000 && size > bestEnd-bestStart {
				bestStart, bestEnd = index, end+2
			}
			index = end + 1
			break
		}
	}
	if bestStart < 0 {
		return nil
	}
	return bytes.Clone(data[bestStart:bestEnd])
}

func collectTiffJPEGs(data []byte) [][]byte {
	if len(data) < 8 {
		return nil
	}
	var order binary.ByteOrder
	switch {
	case bytes.HasPrefix(data, []byte("II*\x00")):
		order = binary.LittleEndian
	case bytes.HasPrefix(data, []byte("MM\x00*")):
		order = binary.BigEndian
	default:
		return nil
	}
	ifd := order.Uint32(data[4:8])
	var found [][]byte
	visited := map[uint32]struct{}{}
	walkTIFFIFD(data, order, ifd, visited, &found, 0)
	return found
}

func walkTIFFIFD(data []byte, order binary.ByteOrder, offset uint32, visited map[uint32]struct{}, found *[][]byte, depth int) {
	if depth > 12 || offset < 8 || int(offset)+2 > len(data) {
		return
	}
	if _, seen := visited[offset]; seen {
		return
	}
	visited[offset] = struct{}{}
	count := int(order.Uint16(data[offset : offset+2]))
	entriesStart := int(offset) + 2
	if count <= 0 || count > 256 || entriesStart+count*12+4 > len(data) {
		return
	}
	var jpegOffset, jpegLength uint32
	var stripOffsets, stripCounts []uint32
	var subIFDs []uint32
	for index := 0; index < count; index++ {
		entry := data[entriesStart+index*12 : entriesStart+index*12+12]
		tag := order.Uint16(entry[0:2])
		fieldType := order.Uint16(entry[2:4])
		countValue := order.Uint32(entry[4:8])
		value := order.Uint32(entry[8:12])
		switch tag {
		case 513:
			jpegOffset = tiffScalar(data, order, fieldType, countValue, value)
		case 514:
			jpegLength = tiffScalar(data, order, fieldType, countValue, value)
		case 273:
			stripOffsets = tiffLongs(data, order, fieldType, countValue, value)
		case 279:
			stripCounts = tiffLongs(data, order, fieldType, countValue, value)
		case 330:
			subIFDs = tiffLongs(data, order, fieldType, countValue, value)
		}
	}
	if jpegLength >= 20_000 && int(jpegOffset)+int(jpegLength) <= len(data) {
		*found = append(*found, bytes.Clone(data[jpegOffset:jpegOffset+jpegLength]))
	}
	if len(stripOffsets) > 0 && len(stripOffsets) == len(stripCounts) {
		var joined []byte
		for index, start := range stripOffsets {
			length := int(stripCounts[index])
			if int(start)+length > len(data) || length <= 0 {
				joined = nil
				break
			}
			joined = append(joined, data[start:int(start)+length]...)
		}
		if bytes.HasPrefix(joined, []byte{0xff, 0xd8}) {
			*found = append(*found, joined)
		}
	}
	next := order.Uint32(data[entriesStart+count*12 : entriesStart+count*12+4])
	if next != 0 {
		walkTIFFIFD(data, order, next, visited, found, depth+1)
	}
	for _, sub := range subIFDs {
		walkTIFFIFD(data, order, sub, visited, found, depth+1)
	}
}

func tiffScalar(data []byte, order binary.ByteOrder, fieldType uint16, count, value uint32) uint32 {
	longs := tiffLongs(data, order, fieldType, count, value)
	if len(longs) == 0 {
		return 0
	}
	return longs[0]
}

func tiffLongs(data []byte, order binary.ByteOrder, fieldType uint16, count, value uint32) []uint32 {
	if count == 0 || count > 64 {
		return nil
	}
	size := uint32(4)
	if fieldType == 3 {
		size = 2
	}
	byteCount := count * size
	var payload []byte
	if byteCount <= 4 {
		buf := make([]byte, 4)
		order.PutUint32(buf, value)
		payload = buf[:byteCount]
	} else {
		if int(value)+int(byteCount) > len(data) {
			return nil
		}
		payload = data[value : value+byteCount]
	}
	result := make([]uint32, 0, count)
	for index := uint32(0); index < count; index++ {
		if fieldType == 3 {
			result = append(result, uint32(order.Uint16(payload[index*2:index*2+2])))
			continue
		}
		result = append(result, order.Uint32(payload[index*4:index*4+4]))
	}
	return result
}

func collectBoxJPEGs(data []byte) [][]byte {
	if len(data) < 12 || string(data[4:8]) != "ftyp" {
		return nil
	}
	var found [][]byte
	walkBoxes(data, 0, len(data), 0, &found)
	return found
}

func walkBoxes(data []byte, start, end, depth int, found *[][]byte) {
	if depth > 16 || start < 0 || end > len(data) {
		return
	}
	offset := start
	for offset+8 <= end {
		size := int(binary.BigEndian.Uint32(data[offset : offset+4]))
		boxType := string(data[offset+4 : offset+8])
		header := 8
		if size == 1 {
			if offset+16 > end {
				return
			}
			size = int(binary.BigEndian.Uint64(data[offset+8 : offset+16]))
			header = 16
		}
		if size == 0 {
			size = end - offset
		}
		if size < header || offset+size > end {
			return
		}
		payloadStart := offset + header
		payloadEnd := offset + size
		switch boxType {
		case "moov", "trak", "mdia", "minf", "stbl", "uuid", "CRAW", "cctp", "CDI1":
			walkBoxes(data, payloadStart, payloadEnd, depth+1, found)
		case "PRVW", "THMB", "JPEG", "preview":
			if jpeg := scanLargestJPEG(data[payloadStart:payloadEnd]); len(jpeg) > 0 {
				*found = append(*found, jpeg)
			} else if idx := bytes.Index(data[payloadStart:payloadEnd], []byte{0xff, 0xd8}); idx >= 0 {
				if jpeg := scanLargestJPEG(data[payloadStart+idx : payloadEnd]); len(jpeg) > 0 {
					*found = append(*found, jpeg)
				}
			}
		}
		offset += size
	}
}
